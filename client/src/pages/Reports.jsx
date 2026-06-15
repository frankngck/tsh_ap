import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────
const fmt = (n) =>
  `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]}`;
};

// ─── Skeleton block ───────────────────────────────────────────────
function Sk({ w = '100%', h = 14, r = 4, mb = 0 }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, marginBottom: mb, display: 'block' }}
    />
  );
}

// ─── Ageing bar ───────────────────────────────────────────────────
const AGEING_BUCKETS = [
  { key: 'current',        label: 'Current',    color: '#10B981', textColor: '#065F46' },
  { key: 'overdue_1_30',   label: '1–30 days',  color: '#3B82F6', textColor: '#1E40AF' },
  { key: 'overdue_31_60',  label: '31–60 days', color: '#F59E0B', textColor: '#92400E' },
  { key: 'overdue_61_90',  label: '61–90 days', color: '#F97316', textColor: '#9A3412' },
  { key: 'overdue_90plus', label: '90+ days',   color: '#EF4444', textColor: '#991B1B' },
];

function AgeingBars({ suppliers, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {AGEING_BUCKETS.map((b) => (
          <div key={b.key}>
            <Sk w="60%" h={11} mb={6} />
            <Sk h={22} r={4} />
          </div>
        ))}
      </div>
    );
  }

  const totals = {};
  for (const b of AGEING_BUCKETS) {
    totals[b.key] = (suppliers || []).reduce((s, sup) => s + (sup[b.key] || 0), 0);
  }
  const grand = Object.values(totals).reduce((s, v) => s + v, 0);

  if (grand === 0) {
    return (
      <div className="empty-state" style={{ padding: '24px 0' }}>
        <p>No outstanding balances.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {AGEING_BUCKETS.map((b) => {
        const pct = grand > 0 ? ((totals[b.key] / grand) * 100) : 0;
        return (
          <div key={b.key}>
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'baseline',
              marginBottom:   5,
              fontSize:       12,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{b.label}</span>
              <span style={{ color: totals[b.key] > 0 ? b.textColor : 'var(--gray-400)', fontWeight: totals[b.key] > 0 ? 700 : 400 }}>
                {fmt(totals[b.key])}
                <span style={{ color: 'var(--gray-400)', fontWeight: 400, marginLeft: 6 }}>
                  {pct.toFixed(1)}%
                </span>
              </span>
            </div>
            <div style={{
              height:       20,
              background:   'var(--gray-100)',
              borderRadius: 4,
              overflow:     'hidden',
            }}>
              {pct > 0 && (
                <div style={{
                  width:        `${pct}%`,
                  height:       '100%',
                  background:   b.color,
                  borderRadius: 4,
                  transition:   'width 0.6s ease',
                }} />
              )}
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, textAlign: 'right' }}>
        Grand total: <strong style={{ color: 'var(--gray-800)' }}>{fmt(grand)}</strong>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function Reports() {
  const [outstanding, setOutstanding] = useState(null);
  const [cf7,         setCf7]         = useState(null);
  const [cf14,        setCf14]        = useState(null);
  const [cf30,        setCf30]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/reports/outstanding'),
      api.get('/reports/cashflow?days=7'),
      api.get('/reports/cashflow?days=14'),
      api.get('/reports/cashflow?days=30'),
    ])
      .then(([o, c7, c14, c30]) => {
        setOutstanding(o.data);
        setCf7(c7.data);
        setCf14(c14.data);
        setCf30(c30.data);
      })
      .catch(() => setError('Failed to load report data. Is the server running?'))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived totals ─────────────────────────────────────────────
  const suppliers    = outstanding?.suppliers || [];
  const grandTotal   = outstanding?.grandTotal || 0;
  const totalCurrent = suppliers.reduce((s, x) => s + (x.current || 0), 0);
  const total1to30   = suppliers.reduce((s, x) => s + (x.overdue_1_30 || 0), 0);
  const total31plus  = suppliers.reduce(
    (s, x) => s + (x.overdue_31_60 || 0) + (x.overdue_61_90 || 0) + (x.overdue_90plus || 0),
    0
  );
  const suppliersOwed = suppliers.filter((s) => s.totalOutstanding > 0).length;

  // Table footer totals
  const colTotals = {
    totalOutstanding: suppliers.reduce((s, x) => s + x.totalOutstanding, 0),
    current:          suppliers.reduce((s, x) => s + x.current, 0),
    overdue_1_30:     suppliers.reduce((s, x) => s + x.overdue_1_30, 0),
    overdue_31_60:    suppliers.reduce((s, x) => s + x.overdue_31_60, 0),
    overdue_61_90:    suppliers.reduce((s, x) => s + x.overdue_61_90, 0),
    overdue_90plus:   suppliers.reduce((s, x) => s + x.overdue_90plus, 0),
  };

  // Bills for attention table: sort by daysUntilDue (most urgent first)
  const attentionBills = (cf30?.bills || [])
    .slice()
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  if (error) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">Reports</h1></div>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          {!loading && outstanding?.generatedAt && (
            <div className="page-subtitle">
              Generated: {new Date(outstanding.generatedAt).toLocaleString('en-SG')}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          SECTION 1: Accounts Payable Report
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-section-title">Accounts Payable Report</div>

      {/* ── Summary Cards ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {loading ? (
          [1,2,3,4].map((i) => (
            <div key={i} className="stat-card">
              <Sk w="55%" h={11} mb={10} />
              <Sk w="72%" h={28} mb={6} />
              <Sk w="48%" h={11} />
            </div>
          ))
        ) : (
          <>
            <div className="stat-card red">
              <div className="stat-label">Total Outstanding</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{fmt(grandTotal)}</div>
              <div className="stat-sub">{suppliersOwed} supplier{suppliersOwed !== 1 ? 's' : ''} owed</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Current (0–30 days)</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{fmt(totalCurrent + total1to30)}</div>
              <div className="stat-sub">Within payment terms</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: total31plus > 0 ? 'var(--red)' : 'var(--gray-300)' }}>
              <div className="stat-label">Overdue (31+ days)</div>
              <div
                className="stat-value"
                style={{ fontSize: 22, color: total31plus > 0 ? 'var(--red)' : 'var(--gray-400)' }}
              >
                {fmt(total31plus)}
              </div>
              <div className="stat-sub">Requires urgent attention</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-label">Suppliers Owed</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{suppliersOwed}</div>
              <div className="stat-sub">With outstanding balances</div>
            </div>
          </>
        )}
      </div>

      {/* ── Outstanding by Supplier Table ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Outstanding by Supplier</span>
        </div>
        <div className="table-container" style={{ boxShadow: 'none', borderRadius: 0 }}>
          {loading ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th style={{ textAlign: 'right' }}>Total Owed</th>
                  <th style={{ textAlign: 'right' }}>Current (0–30)</th>
                  <th style={{ textAlign: 'right' }}>31–60 Days</th>
                  <th style={{ textAlign: 'right' }}>61–90 Days</th>
                  <th style={{ textAlign: 'right' }}>Over 90 Days</th>
                </tr>
              </thead>
              <tbody>
                {[1,2,3,4].map((i) => (
                  <tr key={i}>
                    {[160,90,90,80,80,80].map((w, j) => (
                      <td key={j} style={j > 0 ? { textAlign: 'right' } : undefined}>
                        <div className="skeleton" style={{ height: 14, width: w, borderRadius: 4, marginLeft: j > 0 ? 'auto' : undefined }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : suppliers.length === 0 ? (
            <div className="empty-state"><p>No outstanding payables — all clear!</p></div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th style={{ textAlign: 'right' }}>Total Owed</th>
                  <th style={{ textAlign: 'right' }}>Current (0–30)</th>
                  <th style={{ textAlign: 'right' }}>31–60 Days</th>
                  <th style={{ textAlign: 'right' }}>61–90 Days</th>
                  <th style={{ textAlign: 'right' }}>Over 90 Days</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.supplierId}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--gray-800)' }}>{s.companyName}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                        {s.supplierCode} · {s.bills.length} bill{s.bills.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(s.totalOutstanding)}</td>
                    {/* Current (0-30): not-yet-due + 1-30 days overdue */}
                    <td style={{ textAlign: 'right' }}>
                      {(s.current + s.overdue_1_30) > 0
                        ? fmt(s.current + s.overdue_1_30)
                        : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', color: s.overdue_31_60 > 0 ? 'var(--amber)' : undefined }}>
                      {s.overdue_31_60 > 0 ? fmt(s.overdue_31_60) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', color: s.overdue_61_90 > 0 ? 'var(--red)' : undefined }}>
                      {s.overdue_61_90 > 0 ? fmt(s.overdue_61_90) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', color: s.overdue_90plus > 0 ? 'var(--red)' : undefined, fontWeight: s.overdue_90plus > 0 ? 700 : undefined }}>
                      {s.overdue_90plus > 0 ? fmt(s.overdue_90plus) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--gray-100)', fontWeight: 700 }}>
                  <td>TOTAL</td>
                  <td style={{ textAlign: 'right', color: 'var(--red)' }}>{fmt(colTotals.totalOutstanding)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(colTotals.current + colTotals.overdue_1_30)}</td>
                  <td style={{ textAlign: 'right', color: colTotals.overdue_31_60 > 0 ? 'var(--amber)' : undefined }}>{fmt(colTotals.overdue_31_60)}</td>
                  <td style={{ textAlign: 'right', color: colTotals.overdue_61_90 > 0 ? 'var(--red)' : undefined }}>{fmt(colTotals.overdue_61_90)}</td>
                  <td style={{ textAlign: 'right', color: colTotals.overdue_90plus > 0 ? 'var(--red)' : undefined }}>{fmt(colTotals.overdue_90plus)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ── Cash Flow Forecast Strip ── */}
      <div className="rpt-cashflow-strip">
        <span className="rpt-cashflow-label">Cash flow forecast:</span>
        {loading ? (
          <>
            <Sk w={120} h={14} r={4} />
            <Sk w={120} h={14} r={4} />
            <Sk w={120} h={14} r={4} />
          </>
        ) : (
          <>
            <span className="rpt-cashflow-item">
              <span className="rpt-cashflow-period">Next 7 days</span>
              <strong style={{ color: 'var(--teal)' }}>{fmt(cf7?.totalDue)}</strong>
            </span>
            <span className="rpt-cashflow-sep">|</span>
            <span className="rpt-cashflow-item">
              <span className="rpt-cashflow-period">Next 14 days</span>
              <strong style={{ color: 'var(--teal)' }}>{fmt(cf14?.totalDue)}</strong>
            </span>
            <span className="rpt-cashflow-sep">|</span>
            <span className="rpt-cashflow-item">
              <span className="rpt-cashflow-period">Next 30 days</span>
              <strong style={{ color: 'var(--teal)' }}>{fmt(cf30?.totalDue)}</strong>
            </span>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          Divider
      ════════════════════════════════════════════════════════════ */}
      <hr className="rpt-divider" />

      {/* ════════════════════════════════════════════════════════════
          SECTION 2: AP Ageing & Cash Flow Analysis
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-section-title">AP Ageing &amp; Cash Flow Analysis</div>

      <div className="rpt-s2-grid">

        {/* ── LEFT: Ageing distribution ── */}
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header">
            <span className="card-title">Ageing Distribution</span>
          </div>
          <div className="card-body">
            <AgeingBars suppliers={suppliers} loading={loading} />
          </div>
        </div>

        {/* ── RIGHT: Bills Requiring Attention ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Bills Requiring Attention</span>
            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Due within 30 days</span>
          </div>
          <div className="table-container" style={{ boxShadow: 'none', borderRadius: 0 }}>
            {loading ? (
              <table className="table">
                <thead>
                  <tr>
                    {['Bill #','Supplier','Bill Date','Due Date','Days','Amount','Status'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4].map((i) => (
                    <tr key={i}>
                      {[80,120,60,60,55,80,65].map((w, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 13, width: w, borderRadius: 4 }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : attentionBills.length === 0 ? (
              <div className="empty-state" style={{ padding: '28px 24px' }}>
                <p>No bills due in the next 30 days.</p>
                <Link to="/bills/new" className="btn btn-sm btn-primary" style={{ marginTop: 12 }}>
                  + Record Bill
                </Link>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Supplier</th>
                    <th>PO #</th>
                    <th>Bill Date</th>
                    <th>Due Date</th>
                    <th>Days</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionBills.map((b) => {
                    const overdue  = b.daysUntilDue < 0;
                    const imminent = !overdue && b.daysUntilDue <= 7;
                    return (
                      <tr key={b.id}>
                        <td>
                          <Link
                            to={`/bills/${b.id}`}
                            style={{ fontWeight: 700, color: 'var(--teal)', whiteSpace: 'nowrap' }}
                          >
                            {b.billNumber}
                          </Link>
                        </td>
                        <td style={{ fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.supplier || '—'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace' }}>
                          {b.poNumber || <span style={{ color: 'var(--gray-200)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(b.billDate)}</td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(b.dueDate)}</td>
                        <td>
                          {overdue ? (
                            <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 12 }}>
                              {Math.abs(b.daysUntilDue)}d overdue
                            </span>
                          ) : (
                            <span style={{
                              color:      imminent ? 'var(--amber)' : 'var(--gray-600)',
                              fontWeight: imminent ? 700 : undefined,
                              fontSize:   12,
                            }}>
                              {b.daysUntilDue === 0 ? 'Today' : `${b.daysUntilDue} days`}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                          {fmt(b.outstanding)}
                        </td>
                        <td>
                          <span className={`badge badge-${b.status?.toLowerCase()}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>{/* end rpt-s2-grid */}
    </div>
  );
}
