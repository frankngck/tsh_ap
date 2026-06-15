import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

const fmt = (n) =>
  `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};

// ─── Skeleton block ───────────────────────────────────────────────
function Sk({ w = '100%', h = 16, r = 4, mb = 0 }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, marginBottom: mb, display: 'block' }}
    />
  );
}

// ─── Summary Card ─────────────────────────────────────────────────
function SummaryCard({ label, value, sub, accent, loading }) {
  if (loading) {
    return (
      <div className={`dsh-card dsh-card--${accent}`}>
        <Sk w="55%" h={12} mb={14} />
        <Sk w="72%" h={32} mb={10} />
        <Sk w="48%" h={11} />
      </div>
    );
  }
  return (
    <div className={`dsh-card dsh-card--${accent}`}>
      <div className="dsh-label">{label}</div>
      <div className="dsh-value">{value}</div>
      {sub && <div className="dsh-sub">{sub}</div>}
    </div>
  );
}

// ─── Ageing stacked bar ───────────────────────────────────────────
const BUCKETS = [
  { key: 'current',       label: 'Current',  color: '#10B981' },
  { key: 'overdue_1_30',  label: '1–30 d',   color: '#3B82F6' },
  { key: 'overdue_31_60', label: '31–60 d',  color: '#F59E0B' },
  { key: 'overdue_61_90', label: '61–90 d',  color: '#F97316' },
  { key: 'overdue_90plus',label: '90+ d',    color: '#EF4444' },
];

function AgeingSection({ data, loading }) {
  if (loading) {
    return (
      <div className="card">
        <div className="card-header"><Sk w={200} h={14} /></div>
        <div className="card-body">
          <Sk h={44} mb={20} r={6} />
          <div style={{ display: 'flex', gap: 24 }}>
            {BUCKETS.map((b) => (
              <div key={b.key}>
                <Sk w={60} h={11} mb={5} />
                <Sk w={80} h={18} mb={4} />
                <Sk w={36} h={11} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const suppliers = data?.suppliers || [];
  const totals = Object.fromEntries(
    BUCKETS.map((b) => [b.key, suppliers.reduce((s, sup) => s + (sup[b.key] || 0), 0)])
  );
  const grand = Object.values(totals).reduce((s, v) => s + v, 0);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">AP Ageing Summary</span>
        <Link to="/reports" className="btn btn-sm btn-outline">Full Report →</Link>
      </div>
      <div className="card-body">
        {grand === 0 ? (
          <div className="empty-state" style={{ padding: '16px 0' }}>
            <p>No outstanding payables — all clear!</p>
          </div>
        ) : (
          <>
            <div className="ageing-bar">
              {BUCKETS.filter((b) => totals[b.key] > 0).map((b) => (
                <div
                  key={b.key}
                  className="ageing-seg"
                  style={{
                    width: `${(totals[b.key] / grand) * 100}%`,
                    background: b.color,
                  }}
                  title={`${b.label}: ${fmt(totals[b.key])} · ${((totals[b.key] / grand) * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="ageing-legend">
              {BUCKETS.map((b) => (
                <div key={b.key} className="ageing-item">
                  <div className="ageing-dot" style={{ background: b.color }} />
                  <div>
                    <div className="ageing-bucket-label">{b.label}</div>
                    <div
                      className="ageing-bucket-value"
                      style={{ color: totals[b.key] > 0 ? b.color : 'var(--gray-300)' }}
                    >
                      {fmt(totals[b.key])}
                    </div>
                    <div className="ageing-bucket-pct">
                      {grand > 0 ? `${((totals[b.key] / grand) * 100).toFixed(1)}%` : '—'}
                    </div>
                  </div>
                </div>
              ))}
              <div className="ageing-item" style={{ marginLeft: 'auto' }}>
                <div>
                  <div className="ageing-bucket-label">TOTAL</div>
                  <div className="ageing-bucket-value" style={{ color: 'var(--gray-800)', fontSize: 16 }}>
                    {fmt(grand)}
                  </div>
                  <div className="ageing-bucket-pct">
                    {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Upcoming Payments ────────────────────────────────────────────
function UpcomingPayments({ data, loading }) {
  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="card" style={{ height: '100%' }}>
        <div className="card-header"><Sk w={200} h={14} /></div>
        <div style={{ padding: '16px 20px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <Sk w={70} h={13} />
              <Sk w={130} h={13} />
              <Sk w={76} h={13} />
              <Sk w={80} h={13} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const bills = (data?.bills || []).slice(0, 5);

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <span className="card-title">Upcoming Payments Due</span>
        <Link to="/bills" className="btn btn-sm btn-outline">View All</Link>
      </div>
      {bills.length === 0 ? (
        <div className="empty-state" style={{ padding: '28px 20px' }}>
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
              <th>Due Date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => {
              const overdue  = b.dueDate < today;
              const imminent = !overdue && b.daysUntilDue <= 7;
              return (
                <tr key={b.id}>
                  <td>
                    <Link to={`/bills/${b.id}`} style={{ fontWeight: 600, color: 'var(--teal)' }}>
                      {b.billNumber}
                    </Link>
                  </td>
                  <td
                    style={{
                      maxWidth: 150,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                    }}
                  >
                    {b.supplier}
                  </td>
                  <td>
                    <span
                      style={{
                        color:      overdue ? 'var(--red)' : imminent ? 'var(--amber)' : 'var(--gray-700)',
                        fontWeight: (overdue || imminent) ? 600 : undefined,
                        fontSize:   13,
                        display:    'flex',
                        alignItems: 'center',
                        gap:        5,
                      }}
                    >
                      {fmtDate(b.dueDate)}
                      {overdue  && <span className="due-chip due-chip--red">OVERDUE</span>}
                      {imminent && !overdue && <span className="due-chip due-chip--amber">{b.daysUntilDue}d</span>}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--teal)' }}>
                    {fmt(b.outstanding)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── AI Insights Panel ───────────────────────────────────────────
const INSIGHT_STYLE = {
  warning:  { dot: 'var(--red)',   text: 'var(--red)',   prefix: '⚠ ' },
  positive: { dot: 'var(--green)', text: 'var(--green)', prefix: '✓ ' },
  info:     { dot: '#3B82F6',      text: '#1D4ED8',      prefix: ''   },
  deadline: { dot: 'var(--amber)', text: '#92400E',      prefix: '⏰ ' },
};

function AiInsightsPanel({ insights, loading, error, onRefresh }) {
  return (
    <div style={{
      background:   '#F3F0FF',
      borderLeft:   '4px solid #7C3AED',
      borderRadius: 8,
      padding:      '16px 20px',
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#7C3AED', fontSize: 15 }}>✦</span>
          <span style={{ fontWeight: 700, color: '#4C1D95', fontSize: 15 }}>AI Insights</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            background:   'none',
            border:       '1px solid #C4B5FD',
            borderRadius: 6,
            padding:      '3px 10px',
            fontSize:     12,
            color:        '#7C3AED',
            cursor:       loading ? 'not-allowed' : 'pointer',
            opacity:      loading ? 0.5 : 1,
          }}
        >
          ↺ Refresh
        </button>
      </div>

      {/* Skeleton while loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[78, 60, 85].map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
              <div className="skeleton" style={{ height: 13, width: `${w}%`, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{ fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Unable to load AI insights.</span>
          <button
            type="button"
            onClick={onRefresh}
            style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Insights list */}
      {!loading && !error && insights.map((ins, i) => {
        const s = INSIGHT_STYLE[ins.type] || INSIGHT_STYLE.info;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < insights.length - 1 ? 10 : 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 5 }} />
            <span style={{ fontSize: 13, color: s.text, lineHeight: 1.6 }}>
              {s.prefix}{ins.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────
const ACTIONS = [
  { label: '+ New Supplier',  path: '/suppliers/new', primary: true  },
  { label: '+ Record Bill',   path: '/bills/new',     primary: true  },
  { label: '+ Make Payment',  path: '/payments/new',  primary: true  },
  { label: 'View Reports',    path: '/reports',       primary: false },
];

function QuickActions() {
  const navigate = useNavigate();
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <span className="card-title">Quick Actions</span>
      </div>
      <div className="card-body">
        <div className="qa-grid">
          {ACTIONS.map((a) => (
            <button
              key={a.path}
              className={`qa-btn ${a.primary ? 'qa-btn--primary' : 'qa-btn--secondary'}`}
              onClick={() => navigate(a.path)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────
export default function Dashboard() {
  const [summary,       setSummary]       = useState(null);
  const [outstanding,   setOutstanding]   = useState(null);
  const [cashflow,      setCashflow]      = useState(null);
  const [insights,      setInsights]      = useState([]);
  const [loadS,         setLoadS]         = useState(true);
  const [loadO,         setLoadO]         = useState(true);
  const [loadC,         setLoadC]         = useState(true);
  const [loadInsights,  setLoadInsights]  = useState(true);
  const [error,         setError]         = useState('');
  const [insightsError, setInsightsError] = useState('');

  const fetchInsights = () => {
    setLoadInsights(true);
    setInsightsError('');
    api.get('/ai/dashboard-insights')
      .then((r) => setInsights(r.data.insights || []))
      .catch(() => setInsightsError('Unable to load AI insights'))
      .finally(() => setLoadInsights(false));
  };

  useEffect(() => {
    api.get('/reports/summary')
      .then((r) => setSummary(r.data))
      .catch(() => setError('Failed to load dashboard data. Is the server running?'))
      .finally(() => setLoadS(false));
    api.get('/reports/outstanding')
      .then((r) => setOutstanding(r.data))
      .catch(() => {})
      .finally(() => setLoadO(false));
    api.get('/reports/cashflow?days=30')
      .then((r) => setCashflow(r.data))
      .catch(() => {})
      .finally(() => setLoadC(false));
    fetchInsights();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">
            Accounts Payable Overview
            {summary?.period?.today && ` — ${fmtDate(summary.period.today)}`}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* ── TOP ROW: 4 Summary Cards ── */}
      <div className="dsh-summary-row">
        <SummaryCard
          label="Total Payables"
          value={fmt(summary?.totalPayables)}
          sub={`${summary?.outstandingBillCount ?? 0} outstanding bills`}
          accent="red"
          loading={loadS}
        />
        <SummaryCard
          label="Due This Week"
          value={fmt(summary?.dueThisWeek)}
          sub={`${summary?.dueThisWeekCount ?? 0} bills due`}
          accent="amber"
          loading={loadS}
        />
        <SummaryCard
          label="Paid (MTD)"
          value={fmt(summary?.paidMTD)}
          sub={`Since ${summary?.period?.monthStart ?? '—'}`}
          accent="green"
          loading={loadS}
        />
        <SummaryCard
          label="Active Suppliers"
          value={loadS ? '—' : (summary?.activeSupplierCount ?? 0)}
          sub="Registered suppliers"
          accent="blue"
          loading={loadS}
        />
      </div>

      {/* ── MIDDLE ROW: AP Ageing ── */}
      <div style={{ marginBottom: 20 }}>
        <AgeingSection data={outstanding} loading={loadO} />
      </div>

      {/* ── AI INSIGHTS ── */}
      <AiInsightsPanel
        insights={insights}
        loading={loadInsights}
        error={insightsError}
        onRefresh={fetchInsights}
      />

      {/* ── BOTTOM ROW: Table + Quick Actions ── */}
      <div className="dsh-bottom-row">
        <UpcomingPayments data={cashflow} loading={loadC} />
        <QuickActions />
      </div>
    </div>
  );
}
