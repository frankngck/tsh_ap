import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const STATUS_TABS = [
  { label: 'All',      value: '' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Paid',     value: 'PAID' },
  { label: 'Disputed', value: 'DISPUTED' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────
const fmtDate = (s) => {
  if (!s) return '—';
  const parts = String(s).slice(0, 10).split('-');
  if (parts.length < 3) return s;
  const [, mm, dd] = parts;
  return `${dd} ${MONTHS[parseInt(mm, 10) - 1]}`;
};

const fmt = (n) =>
  `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

// ─── Status badge ─────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status?.toLowerCase()}`}>
      {status}
    </span>
  );
}

// ─── 3-Way match icon ─────────────────────────────────────────────
function MatchIcon({ status }) {
  if (status === 'MATCHED')
    return <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 16 }} title="Matched">✓</span>;
  if (status === 'DISCREPANCY')
    return <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 16 }} title="Discrepancy">✗</span>;
  return <span style={{ color: 'var(--gray-300)', fontSize: 16 }} title="Not checked">—</span>;
}

// ─── Table skeleton ───────────────────────────────────────────────
function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          {[90, 140, 75, 55, 55, 85, 75, 85, 50, 70, 90].map((w, j) => (
            <td key={j} style={j >= 5 && j <= 7 ? { textAlign: 'right' } : undefined}>
              <div
                className="skeleton"
                style={{
                  height: 14,
                  width: w,
                  borderRadius: 4,
                  marginLeft: j >= 5 && j <= 7 ? 'auto' : undefined,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ─── Manager approve modal ────────────────────────────────────────
function ManagerApproveModal({ bill, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Final Approval — Manager</h3>
        </div>
        <div className="modal-body">
          <p>
            Final-approve <strong>{bill.billNumber}</strong> from{' '}
            <strong>{bill.supplier?.companyName}</strong>?
          </p>
          <p className="modal-warning">
            Total: {`S$${Number(bill.total || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`}
            {' '}· This is a high-value bill requiring manager sign-off.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ background: '#B45309', borderColor: '#B45309' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <><span className="spinner" />Approving…</> : '✓ Final Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Approve confirmation modal ───────────────────────────────────
function ApproveModal({ bill, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Approve Bill</h3>
        </div>
        <div className="modal-body">
          <p>
            Approve <strong>{bill.billNumber}</strong> from{' '}
            <strong>{bill.supplier?.companyName}</strong>?
          </p>
          <p className="modal-warning">
            Total: {fmt(bill.total)} · Once approved, this bill can receive payments.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? <><span className="spinner" />Approving…</> : 'Approve'}
          </button>
        </div>
      </div>
    </div>
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
        Showing {start}–{end} of {total} bill{total !== 1 ? 's' : ''}
      </span>
      <div className="pagination-btns">
        <button className="pg-btn" onClick={() => onChange(page - 1)} disabled={page === 1}>
          ‹
        </button>
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
        <button className="pg-btn" onClick={() => onChange(page + 1)} disabled={page === totalPages}>
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function BillList() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [bills,         setBills]         = useState([]);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState('');
  const [page,          setPage]          = useState(1);
  const [approveTarget,        setApproveTarget]        = useState(null);
  const [approving,            setApproving]            = useState(false);
  const [managerApproveTarget, setManagerApproveTarget] = useState(null);
  const [managerApproving,     setManagerApproving]     = useState(false);
  const [error,                setError]                = useState('');

  // ── Fetch ──────────────────────────────────────────────────────
  const load = (status = activeTab, pg = page) => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page: pg, limit: PAGE_SIZE });
    if (status) qs.set('status', status);
    api.get(`/bills?${qs}`)
      .then((r) => {
        setBills(r.data.data || []);
        setTotal(r.data.total || 0);
      })
      .catch(() => setError('Failed to load bills. Is the server running?'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab change ─────────────────────────────────────────────────
  const handleTab = (val) => {
    setActiveTab(val);
    setPage(1);
    load(val, 1);
  };

  // ── Page change ────────────────────────────────────────────────
  const handlePage = (p) => {
    setPage(p);
    load(activeTab, p);
  };

  // ── Tier-1 approve flow ────────────────────────────────────────
  const handleApproveConfirm = async () => {
    if (!approveTarget) return;
    setApproving(true);
    try {
      const res = await api.patch(`/bills/${approveTarget.id}/approve`);
      setApproveTarget(null);
      if (res.data.requiresManagerApproval) {
        setError('');
      }
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Approve failed. Please try again.');
      setApproveTarget(null);
    } finally {
      setApproving(false);
    }
  };

  // ── Tier-2 manager approve flow ────────────────────────────────
  const handleManagerApproveConfirm = async () => {
    if (!managerApproveTarget) return;
    setManagerApproving(true);
    try {
      await api.patch(`/bills/${managerApproveTarget.id}/manager-approve`);
      setManagerApproveTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Manager approval failed.');
      setManagerApproveTarget(null);
    } finally {
      setManagerApproving(false);
    }
  };

  // ── Subtitle ───────────────────────────────────────────────────
  const subtitle =
    loading ? '' :
    total === 0 ? 'No bills found' :
    `${total} bill${total !== 1 ? 's' : ''}${activeTab ? ` · ${activeTab.charAt(0) + activeTab.slice(1).toLowerCase()}` : ''}`;

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bill Management</h1>
          {!loading && <div className="page-subtitle">{subtitle}</div>}
        </div>
        {!hasRole('manager') && <Link to="/bills/new" className="btn btn-primary">+ Record Bill</Link>}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Filter Tabs ── */}
      <div className="filter-tabs">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            className={`filter-tab${activeTab === t.value ? ' filter-tab--active' : ''}`}
            onClick={() => handleTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Bill #</th>
              <th>Supplier</th>
              <th>PO #</th>
              <th>Date</th>
              <th>Due Date</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
              <th style={{ textAlign: 'right' }}>GST (9%)</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'center' }}>3-Way</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          {loading ? (
            <TableSkeleton />
          ) : bills.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <p>
                      {activeTab
                        ? `No ${activeTab.toLowerCase()} bills found.`
                        : 'No bills yet.'}
                    </p>
                    {!activeTab && (
                      <Link
                        to="/bills/new"
                        className="btn btn-primary"
                        style={{ marginTop: 12 }}
                      >
                        + Record First Bill
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  {/* Bill # */}
                  <td>
                    <Link
                      to={`/bills/${b.id}`}
                      style={{ fontWeight: 700, color: 'var(--teal)', whiteSpace: 'nowrap' }}
                    >
                      {b.billNumber}
                    </Link>
                  </td>

                  {/* Supplier */}
                  <td>
                    <div style={{
                      fontWeight:    500,
                      color:         'var(--gray-800)',
                      maxWidth:      160,
                      overflow:      'hidden',
                      textOverflow:  'ellipsis',
                      whiteSpace:    'nowrap',
                    }}>
                      {b.supplier?.companyName || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                      {b.supplier?.supplierCode}
                    </div>
                  </td>

                  {/* PO # */}
                  <td style={{ fontSize: 12, color: 'var(--gray-500)', fontFamily: 'monospace' }}>
                    {b.purchaseOrder?.poNumber
                      ? b.purchaseOrder.poNumber
                      : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                  </td>

                  {/* Bill Date */}
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                    {fmtDate(b.billDate)}
                  </td>

                  {/* Due Date */}
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                    {fmtDate(b.dueDate)}
                  </td>

                  {/* Subtotal */}
                  <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--gray-600)' }}>
                    {fmt(b.subtotal)}
                  </td>

                  {/* GST */}
                  <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--gray-500)' }}>
                    {fmt(b.gstAmount)}
                  </td>

                  {/* Total */}
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                    {fmt(b.total)}
                  </td>

                  {/* 3-Way match */}
                  <td style={{ textAlign: 'center' }}>
                    <MatchIcon status={b.purchaseOrderId ? b.matchStatus : null} />
                  </td>

                  {/* Status */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <StatusBadge status={b.status} />
                      {b.approvalStage === 'PENDING_MANAGER' && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
                          color: '#92400E', background: '#FEF3C7',
                          padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                        }}>
                          Awaiting Manager
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="table-actions">
                      <Link to={`/bills/${b.id}`} className="btn btn-sm btn-outline">
                        View
                      </Link>
                      {b.purchaseOrderId && hasRole('admin', 'manager') && (
                        <Link
                          to={`/three-way-match?billId=${b.id}`}
                          className="btn btn-sm btn-secondary"
                        >
                          Match
                        </Link>
                      )}
                      {/* Clerk + Admin: Tier-1 approve — only when not yet escalated */}
                      {b.status === 'RECEIVED' && b.approvalStage === 'NONE' && hasRole('admin', 'clerk') && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setApproveTarget(b)}
                        >
                          Approve
                        </button>
                      )}
                      {/* Clerk view when bill is pending manager */}
                      {b.status === 'RECEIVED' && b.approvalStage === 'PENDING_MANAGER' && hasRole('clerk') && !hasRole('admin') && (
                        <span style={{ fontSize: 11, color: '#92400E', fontStyle: 'italic' }}>
                          Pending Manager
                        </span>
                      )}
                      {/* Manager + Admin: Tier-2 final approve */}
                      {b.approvalStage === 'PENDING_MANAGER' && hasRole('admin', 'manager') && (
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ background: '#B45309', borderColor: '#B45309' }}
                          onClick={() => setManagerApproveTarget(b)}
                        >
                          ✓ Final Approve
                        </button>
                      )}
                      {b.status === 'APPROVED' && hasRole('admin', 'clerk') && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => navigate(`/payments/new?billId=${b.id}`)}
                        >
                          Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>

        {/* ── Pagination ── */}
        {!loading && total > PAGE_SIZE && (
          <Pagination
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onChange={handlePage}
          />
        )}
      </div>

      {/* ── Workflow Footer ── */}
      <div className="workflow-footer">
        Status workflow:&nbsp; RECEIVED → (3-Way Match) → APPROVED → PAID &nbsp;|&nbsp; DISPUTED if match fails
      </div>

      {/* ── Tier-1 Approve Modal ── */}
      {approveTarget && (
        <ApproveModal
          bill={approveTarget}
          onConfirm={handleApproveConfirm}
          onCancel={() => setApproveTarget(null)}
          loading={approving}
        />
      )}

      {/* ── Tier-2 Manager Approve Modal ── */}
      {managerApproveTarget && (
        <ManagerApproveModal
          bill={managerApproveTarget}
          onConfirm={handleManagerApproveConfirm}
          onCancel={() => setManagerApproveTarget(null)}
          loading={managerApproving}
        />
      )}
    </div>
  );
}
