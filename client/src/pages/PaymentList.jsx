import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';

// ─── Constants ────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const METHOD_OPTIONS = [
  { value: '',              label: 'All Methods' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE',        label: 'Cheque' },
  { value: 'GIRO',          label: 'GIRO' },
  { value: 'CASH',          label: 'Cash' },
  { value: 'OTHER',         label: 'Other' },
];

const METHOD_LABEL = {
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE:        'Cheque',
  GIRO:          'GIRO',
  CASH:          'Cash',
  OTHER:         'Other',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0].slice(-2)}`;
};

const fmt = (n) =>
  `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

// ─── Summary card ─────────────────────────────────────────────────
function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────
function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          {[65, 85, 140, 90, 90, 100, 80].map((w, j) => (
            <td key={j} style={j === 3 ? { textAlign: 'right' } : undefined}>
              <div
                className="skeleton"
                style={{ height: 14, width: w, borderRadius: 4, marginLeft: j === 3 ? 'auto' : undefined }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ─── Pagination ───────────────────────────────────────────────────
function Pagination({ total, page, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  const pages = new Set(
    [1, totalPages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= totalPages)
  );
  const sorted = [...pages].sort((a, b) => a - b);

  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        Showing {start}–{end} of {total} payment{total !== 1 ? 's' : ''}
      </span>
      <div className="pagination-btns">
        <button className="pg-btn" onClick={() => onChange(page - 1)} disabled={page === 1}>‹</button>
        {sorted.map((p, idx) => {
          const prev = sorted[idx - 1];
          return (
            <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {prev && p - prev > 1 && <span className="pg-ellipsis">…</span>}
              <button
                className={`pg-btn${p === page ? ' pg-btn--active' : ''}`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            </span>
          );
        })}
        <button className="pg-btn" onClick={() => onChange(page + 1)} disabled={page === totalPages}>›</button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function PaymentList() {
  const navigate   = useNavigate();
  const location   = useLocation();

  // ── Success flash from PaymentForm redirect ────────────────────
  const [flashMsg, setFlashMsg] = useState(location.state?.successMsg || '');
  useEffect(() => {
    if (flashMsg) {
      const t = setTimeout(() => setFlashMsg(''), 5000);
      return () => clearTimeout(t);
    }
  }, [flashMsg]);

  // ── Data ───────────────────────────────────────────────────────
  const [allPayments, setAllPayments] = useState([]);
  const [suppliers,   setSuppliers]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [page,        setPage]        = useState(1);

  // ── Filter state ───────────────────────────────────────────────
  const [filters, setFilters] = useState({
    supplierId:    '',
    paymentMethod: '',
    fromDate:      '',
    toDate:        '',
  });
  // Committed filter (applied on "Filter" click)
  const [applied, setApplied] = useState({ ...filters });

  // ── Fetch helpers ──────────────────────────────────────────────
  const loadPayments = (params) => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    if (params.paymentMethod) qs.set('paymentMethod', params.paymentMethod);
    if (params.fromDate)      qs.set('startDate',     params.fromDate);
    if (params.toDate)        qs.set('endDate',        params.toDate);

    const url = `/payments${qs.toString() ? `?${qs}` : ''}`;
    api.get(url)
      .then((r) => { setAllPayments(r.data || []); setPage(1); })
      .catch(() => setError('Failed to load payments. Is the server running?'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/suppliers').then((r) => setSuppliers(r.data || []));
    loadPayments(applied);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client-side supplier filter + memoised result ──────────────
  const filtered = useMemo(() => {
    if (!applied.supplierId) return allPayments;
    return allPayments.filter(
      (p) => String(p.bill?.supplier?.id) === String(applied.supplierId)
    );
  }, [allPayments, applied.supplierId]);

  // ── Pagination slice ───────────────────────────────────────────
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  // ── Summary numbers ────────────────────────────────────────────
  const totalPaid = filtered.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const avgPaid   = filtered.length ? totalPaid / filtered.length : 0;

  // ── Filter apply ───────────────────────────────────────────────
  const applyFilters = () => {
    setApplied({ ...filters });
    // For server-side params (method, dates), re-fetch
    loadPayments(filters);
  };

  const clearFilters = () => {
    const empty = { supplierId: '', paymentMethod: '', fromDate: '', toDate: '' };
    setFilters(empty);
    setApplied(empty);
    loadPayments(empty);
  };

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Payment History</h1>
          {!loading && (
            <div className="page-subtitle">
              {filtered.length} payment{filtered.length !== 1 ? 's' : ''}
              {totalPaid > 0 && ` · Total: ${fmt(totalPaid)}`}
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/payments/new')}>
          + Record Payment
        </button>
      </div>

      {/* ── Flash success message ── */}
      {flashMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          ✓ {flashMsg}
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* ── Filter Row ── */}
      <div className="pay-filter-row">
        {/* Supplier */}
        <select
          className="form-control pay-filter-ctrl"
          value={filters.supplierId}
          onChange={(e) => setF('supplierId', e.target.value)}
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.companyName}</option>
          ))}
        </select>

        {/* Method */}
        <select
          className="form-control pay-filter-ctrl"
          value={filters.paymentMethod}
          onChange={(e) => setF('paymentMethod', e.target.value)}
        >
          {METHOD_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {/* From Date */}
        <div className="pay-filter-date">
          <span className="pay-filter-lbl">From</span>
          <input
            type="date"
            className="form-control pay-filter-ctrl"
            value={filters.fromDate}
            onChange={(e) => setF('fromDate', e.target.value)}
          />
        </div>

        {/* To Date */}
        <div className="pay-filter-date">
          <span className="pay-filter-lbl">To</span>
          <input
            type="date"
            className="form-control pay-filter-ctrl"
            value={filters.toDate}
            onChange={(e) => setF('toDate', e.target.value)}
          />
        </div>

        <button className="btn btn-primary" onClick={applyFilters}>Filter</button>

        {(applied.supplierId || applied.paymentMethod || applied.fromDate || applied.toDate) && (
          <button className="btn btn-secondary" onClick={clearFilters}>Clear</button>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <SummaryCard
          label="Total Paid"
          value={fmt(totalPaid)}
          sub={`${filtered.length} payment${filtered.length !== 1 ? 's' : ''}`}
          accent="green"
        />
        <SummaryCard
          label="Number of Payments"
          value={loading ? '—' : filtered.length}
          sub="Matching current filter"
          accent="blue"
        />
        <SummaryCard
          label="Average Payment"
          value={filtered.length ? fmt(avgPaid) : '—'}
          sub="Per payment"
          accent="amber"
        />
      </div>

      {/* ── Table ── */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bill #</th>
              <th>Supplier</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Method</th>
              <th>Reference</th>
              <th style={{ textAlign: 'right' }}>Bill Balance</th>
            </tr>
          </thead>

          {loading ? (
            <TableSkeleton />
          ) : paginated.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <p>No payments found.</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate('/payments/new')}
                      style={{ marginTop: 12 }}
                    >
                      + Record First Payment
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {paginated.map((p) => {
                const billBalance = p.bill
                  ? parseFloat(p.bill.total || 0) - parseFloat(p.bill.amountPaid || 0)
                  : null;
                return (
                  <tr key={p.id}>
                    {/* Date */}
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      {fmtDate(p.paymentDate)}
                    </td>

                    {/* Bill # */}
                    <td>
                      {p.bill ? (
                        <Link
                          to={`/bills/${p.bill.id}`}
                          style={{ fontWeight: 700, color: 'var(--teal)', whiteSpace: 'nowrap' }}
                        >
                          {p.bill.billNumber}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--gray-300)' }}>—</span>
                      )}
                    </td>

                    {/* Supplier */}
                    <td style={{
                      maxWidth:     160,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                      fontSize:     13,
                    }}>
                      {p.bill?.supplier?.companyName || '—'}
                    </td>

                    {/* Amount */}
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                      {fmt(p.amount)}
                    </td>

                    {/* Method */}
                    <td style={{ fontSize: 13 }}>
                      {METHOD_LABEL[p.paymentMethod] || p.paymentMethod || '—'}
                    </td>

                    {/* Reference */}
                    <td style={{ fontSize: 12, color: 'var(--gray-600)', fontFamily: 'monospace' }}>
                      {p.reference || <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>

                    {/* Bill Balance */}
                    <td style={{ textAlign: 'right', fontSize: 13 }}>
                      {billBalance === null ? (
                        <span style={{ color: 'var(--gray-300)' }}>—</span>
                      ) : billBalance <= 0.005 ? (
                        <span style={{ color: 'var(--green)', fontWeight: 600 }}>Paid in full</span>
                      ) : (
                        <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                          {fmt(billBalance)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>

        {/* ── Pagination ── */}
        {!loading && filtered.length > PAGE_SIZE && (
          <Pagination
            total={filtered.length}
            page={page}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
