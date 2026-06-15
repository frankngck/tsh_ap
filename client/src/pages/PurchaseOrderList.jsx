import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

// ─── Constants ────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};
const fmt = (n) => `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

const FILTER_TABS = [
  { label: 'All',                value: '' },
  { label: 'Draft',              value: 'DRAFT' },
  { label: 'Sent',               value: 'SENT' },
  { label: 'Confirmed',          value: 'RECEIVED' },
  { label: 'Partially Received', value: 'PARTIAL' },
  { label: 'Completed',          value: 'CLOSED' },
];

const STATUS_META = {
  DRAFT:     { label: 'Draft',         cls: 'badge-received' },
  SENT:      { label: 'Sent',          cls: 'badge-approved' },
  RECEIVED:  { label: 'Confirmed',     cls: 'badge-paid' },
  PARTIAL:   { label: 'Part Received', cls: 'badge-disputed',  style: { background: '#FEF3C7', color: '#92400E' } },
  CLOSED:    { label: 'Completed',     cls: '',                style: { background: '#CCFBF1', color: '#0F766E', fontWeight: 700 } },
  CANCELLED: { label: 'Cancelled',     cls: 'badge-disputed' },
};

// ─── Status badge ─────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, cls: '' };
  return (
    <span className={`badge ${m.cls}`} style={m.style || {}}>
      {m.label}
    </span>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────
function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          {[80, 130, 80, 90, 40, 80, 80, 120].map((w, j) => (
            <td key={j}>
              <div className="skeleton" style={{ height: 14, width: w, borderRadius: 4 }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel, loading, confirmLabel = 'Confirm', confirmCls = 'btn-primary' }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3 className="modal-title">{title}</h3></div>
        <div className="modal-body"><p>{message}</p></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={`btn ${confirmCls}`} onClick={onConfirm} disabled={loading}>
            {loading ? <><span className="spinner" />Working…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [error, setError]       = useState('');
  const [actionTarget, setActionTarget] = useState(null); // { po, action: 'send'|'confirm'|'cancel' }
  const [acting, setActing]     = useState(false);

  const load = (status = activeTab) => {
    setLoading(true);
    setError('');
    const qs = status ? `?status=${status}` : '';
    api.get(`/purchase-orders${qs}`)
      .then((r) => setOrders(r.data))
      .catch(() => setError('Failed to load purchase orders. Is the server running?'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTab = (val) => {
    setActiveTab(val);
    load(val);
  };

  // ── Status transitions ─────────────────────────────────────────
  const handleAction = async () => {
    if (!actionTarget) return;
    const { po, action } = actionTarget;
    setActing(true);
    try {
      if (action === 'send')    await api.put(`/purchase-orders/${po.id}/send`);
      if (action === 'confirm') await api.put(`/purchase-orders/${po.id}/confirm`);
      if (action === 'cancel')  await api.put(`/purchase-orders/${po.id}/cancel`);
      setActionTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} PO`);
      setActionTarget(null);
    } finally {
      setActing(false);
    }
  };

  const modalMeta = actionTarget && {
    send:    { title: 'Send Purchase Order',    message: `Send ${actionTarget.po.poNumber} to supplier?`, confirmLabel: 'Send',    confirmCls: 'btn-primary' },
    confirm: { title: 'Confirm Purchase Order', message: `Mark ${actionTarget.po.poNumber} as confirmed by supplier?`, confirmLabel: 'Confirm', confirmCls: 'btn-primary' },
    cancel:  { title: 'Cancel Purchase Order',  message: `Cancel ${actionTarget.po.poNumber}? This cannot be undone.`, confirmLabel: 'Cancel PO', confirmCls: 'btn-danger' },
  }[actionTarget.action];

  const showingText = loading ? '' :
    orders.length === 0 ? 'No purchase orders found' :
    `${orders.length} purchase order${orders.length !== 1 ? 's' : ''}`;

  return (
    <div>
      {/* ── TOP BAR ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Order Management</h1>
          {!loading && <div className="page-subtitle">{showingText}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/supplier-confirmation" className="btn btn-secondary">📋 Confirm Suppliers</Link>
          <Link to="/purchase-orders/new" className="btn btn-primary">+ Create PO</Link>
        </div>
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
              <th>PO #</th>
              <th>Supplier</th>
              <th>PO Date</th>
              <th>Delivery Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          {loading ? <TableSkeleton /> : orders.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <p>{activeTab ? `No ${FILTER_TABS.find(t => t.value === activeTab)?.label} purchase orders.` : 'No purchase orders yet.'}</p>
                    {!activeTab && (
                      <Link to="/purchase-orders/new" className="btn btn-primary" style={{ marginTop: 12 }}>
                        + Create First PO
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {orders.map((po) => (
                <tr key={po.id}>
                  <td>
                    <Link to={`/purchase-orders/${po.id}`} style={{ fontWeight: 600, color: 'var(--teal)' }}>
                      {po.poNumber}
                    </Link>
                  </td>
                  <td>{po.supplier?.companyName || '—'}</td>
                  <td style={{ fontSize: 13 }}>{fmtDate(po.orderDate)}</td>
                  <td style={{ fontSize: 13 }}>{fmtDate(po.expectedDeliveryDate)}</td>
                  <td style={{ textAlign: 'center' }}>{po.itemCount ?? po.items?.length ?? '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(po.total)}</td>
                  <td><StatusBadge status={po.status} /></td>
                  <td>
                    <div className="table-actions">
                      {po.status === 'DRAFT' && (
                        <>
                          <Link to={`/purchase-orders/${po.id}/edit`} className="btn btn-sm btn-outline">Edit</Link>
                          <button className="btn btn-sm btn-primary" onClick={() => setActionTarget({ po, action: 'send' })}>Send</button>
                        </>
                      )}
                      {po.status === 'SENT' && (
                        <>
                          <Link to={`/purchase-orders/${po.id}`} className="btn btn-sm btn-outline">View</Link>
                          <button className="btn btn-sm btn-primary" onClick={() => setActionTarget({ po, action: 'confirm' })}>Confirm</button>
                        </>
                      )}
                      {(po.status === 'RECEIVED' || po.status === 'PARTIAL') && (
                        <>
                          <Link to={`/purchase-orders/${po.id}`} className="btn btn-sm btn-outline">View</Link>
                          <Link to={`/delivery-orders/new?poId=${po.id}`} className="btn btn-sm btn-primary">Receive</Link>
                        </>
                      )}
                      {(po.status === 'CLOSED' || po.status === 'CANCELLED') && (
                        <Link to={`/purchase-orders/${po.id}`} className="btn btn-sm btn-outline">View</Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* ── ACTION MODAL ── */}
      {actionTarget && modalMeta && (
        <ConfirmModal
          {...modalMeta}
          onConfirm={handleAction}
          onCancel={() => setActionTarget(null)}
          loading={acting}
        />
      )}
    </div>
  );
}
