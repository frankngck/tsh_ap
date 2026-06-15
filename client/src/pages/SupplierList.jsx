import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

// ─── Constants ────────────────────────────────────────────────────
const PAGE_SIZE = 10;

const FILTER_TABS = [
  { label: 'All',           value: '' },
  { label: 'Raw Materials', value: 'Raw Materials' },
  { label: 'Components',    value: 'Components' },
  { label: 'Services',      value: 'Services' },
  { label: 'Packaging',     value: 'Packaging' },
];

const CATEGORY_COLORS = {
  'Raw Materials':  { bg: '#DBEAFE', color: '#1E40AF' },
  'Components':     { bg: '#EDE9FE', color: '#5B21B6' },
  'Services':       { bg: '#CCFBF1', color: '#0F766E' },
  'Packaging':      { bg: '#FEF3C7', color: '#92400E' },
  'Logistics':      { bg: '#D1FAE5', color: '#065F46' },
  'IT Equipment':   { bg: '#E0E7FF', color: '#3730A3' },
  'Office Supplies':{ bg: '#F3F4F6', color: '#374151' },
  'Other':          { bg: '#F3F4F6', color: '#374151' },
};

// ─── Category badge ───────────────────────────────────────────────
function CategoryBadge({ category }) {
  const style = CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
  return (
    <span
      style={{
        display:       'inline-block',
        padding:       '3px 10px',
        borderRadius:  12,
        fontSize:      11,
        fontWeight:    600,
        letterSpacing: '0.3px',
        whiteSpace:    'nowrap',
        background:    style.bg,
        color:         style.color,
      }}
    >
      {category || '—'}
    </span>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────
function DeleteModal({ supplier, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Confirm Delete</h3>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete{' '}
            <strong>{supplier.companyName}</strong>?
          </p>
          <p className="modal-warning">
            This action cannot be undone. All related bills will also be affected.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <><span className="spinner" />Deleting…</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────
function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          {[200, 100, 130, 80, 90, 100, 60, 80].map((w, j) => (
            <td key={j}>
              <div className="skeleton" style={{ height: 14, width: w, borderRadius: 4 }} />
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

  // Build page window: always show first, last, current ±1
  const pages = new Set([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);

  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        Showing {start}–{end} of {total} supplier{total !== 1 ? 's' : ''}
      </span>
      <div className="pagination-btns">
        <button
          className="pg-btn"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
        >
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
        <button
          className="pg-btn"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function SupplierList() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('');
  const [page, setPage]               = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null); // supplier obj
  const [deleting, setDeleting]       = useState(false);
  const [error, setError]             = useState('');

  // ── Fetch ──────────────────────────────────────────────────────
  const load = (category = activeTab) => {
    setLoading(true);
    setError('');
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    api.get(`/suppliers${qs}`)
      .then((r) => { setSuppliers(r.data); setPage(1); })
      .catch(() => setError('Failed to load suppliers. Is the server running?'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab change ─────────────────────────────────────────────────
  const handleTab = (val) => {
    setActiveTab(val);
    load(val);
  };

  // ── Pagination slice ───────────────────────────────────────────
  const paginated = useMemo(
    () => suppliers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [suppliers, page]
  );

  // ── Delete flow ────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/suppliers/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Counts per tab (from full unfiltered list or re-fetch)
  // Simple: just show total for the active view
  const showingText =
    loading ? '' :
    suppliers.length === 0 ? 'No suppliers found' :
    suppliers.length === 1 ? '1 supplier' :
    `${suppliers.length} suppliers`;

  return (
    <div>
      {/* ── TOP BAR ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Supplier Management</h1>
          {!loading && <div className="page-subtitle">{showingText}</div>}
        </div>
        <Link to="/suppliers/new" className="btn btn-primary">+ Add Supplier</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── FILTER TABS ── */}
      <div className="filter-tabs">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`filter-tab${activeTab === tab.value ? ' filter-tab--active' : ''}`}
            onClick={() => handleTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TABLE ── */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Category</th>
              <th>Bank Acct</th>
              <th>Terms</th>
              <th>Actions</th>
            </tr>
          </thead>

          {loading ? (
            <TableSkeleton />
          ) : paginated.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <p>
                      {activeTab
                        ? `No ${activeTab} suppliers found.`
                        : 'No suppliers yet.'}
                    </p>
                    {!activeTab && (
                      <Link to="/suppliers/new" className="btn btn-primary" style={{ marginTop: 12 }}>
                        + Add First Supplier
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {paginated.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{s.companyName}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                      {s.supplierCode}
                    </div>
                  </td>
                  <td>{s.contactPerson || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                  <td>
                    {s.email
                      ? <a href={`mailto:${s.email}`} style={{ color: 'var(--teal)', fontSize: 13 }}>{s.email}</a>
                      : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {s.phone || <span style={{ color: 'var(--gray-300)' }}>—</span>}
                  </td>
                  <td>
                    <CategoryBadge category={s.category} />
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--gray-600)' }}>
                    {s.bankAccount
                      ? <span title={`${s.bankName || ''} ${s.bankAccount}`}>
                          {s.bankAccount.length > 10
                            ? `…${s.bankAccount.slice(-6)}`
                            : s.bankAccount}
                        </span>
                      : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display:      'inline-block',
                        padding:      '3px 8px',
                        background:   'var(--gray-100)',
                        borderRadius: 4,
                        fontSize:     12,
                        fontWeight:   600,
                        color:        'var(--gray-600)',
                      }}
                    >
                      {s.paymentTerms ?? 30} days
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Link
                        to={`/suppliers/${s.id}/edit`}
                        className="btn btn-sm btn-outline"
                      >
                        Edit
                      </Link>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => setDeleteTarget(s)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>

        {/* ── PAGINATION ── */}
        {!loading && suppliers.length > 0 && (
          <Pagination
            total={suppliers.length}
            page={page}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        )}
      </div>

      {/* ── DELETE MODAL ── */}
      {deleteTarget && (
        <DeleteModal
          supplier={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
