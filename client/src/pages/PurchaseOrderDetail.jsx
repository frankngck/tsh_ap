import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};
const fmt = (n) => `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

const STATUS_META = {
  DRAFT:     { label: 'Draft',         style: { background: 'var(--gray-200)', color: 'var(--gray-600)' } },
  SENT:      { label: 'Sent',          style: { background: 'var(--blue-light)', color: '#1E40AF' } },
  RECEIVED:  { label: 'Confirmed',     style: { background: 'var(--green-light)', color: '#065F46' } },
  PARTIAL:   { label: 'Part Received', style: { background: 'var(--amber-light)', color: '#92400E' } },
  CLOSED:    { label: 'Completed',     style: { background: 'var(--teal-light)', color: '#0F766E' } },
  CANCELLED: { label: 'Cancelled',     style: { background: 'var(--red-light)', color: '#991B1B' } },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, style: {} };
  return (
    <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, ...m.style }}>
      {m.label}
    </span>
  );
}

function DetailRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 14 }}>
      <span style={{ color: 'var(--gray-500)', minWidth: 150 }}>{label}</span>
      <span style={{ fontWeight: 500, color: 'var(--gray-800)' }}>{children || '—'}</span>
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div>
      <div className="page-header">
        <div className="skeleton" style={{ height: 28, width: 220, borderRadius: 4 }} />
      </div>
      <div className="info-card-grid">
        {[1, 2].map((k) => (
          <div key={k} className="card" style={{ padding: 20 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 14, width: `${50 + i * 10}%`, borderRadius: 4, marginBottom: 14 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [acting, setActing] = useState('');

  useEffect(() => {
    api.get(`/purchase-orders/${id}`)
      .then((r) => setPo(r.data))
      .catch(() => setError('Failed to load purchase order.'))
      .finally(() => setLoading(false));
  }, [id]);

  const doAction = async (action) => {
    setActing(action);
    try {
      await api.put(`/purchase-orders/${id}/${action}`);
      const r = await api.get(`/purchase-orders/${id}`);
      setPo(r.data);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} PO`);
    } finally {
      setActing('');
    }
  };

  if (loading) return <SkeletonDetail />;
  if (error)   return <div className="alert alert-error">{error}</div>;
  if (!po)     return null;

  const subtotal  = parseFloat(po.subtotal  || 0);
  const gstAmount = parseFloat(po.gstAmount || 0);
  const total     = parseFloat(po.total     || 0);

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{po.poNumber}</h1>
            <StatusBadge status={po.status} />
          </div>
          <div className="page-subtitle">{po.supplier?.companyName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {po.status === 'DRAFT' && (
            <>
              <Link to={`/purchase-orders/${po.id}/edit`} className="btn btn-secondary">Edit</Link>
              <button className="btn btn-primary" onClick={() => doAction('send')} disabled={!!acting}>
                {acting === 'send' ? 'Sending…' : 'Send to Supplier'}
              </button>
            </>
          )}
          {po.status === 'SENT' && (
            <button className="btn btn-primary" onClick={() => doAction('confirm')} disabled={!!acting}>
              {acting === 'confirm' ? 'Confirming…' : 'Mark Confirmed'}
            </button>
          )}
          {(po.status === 'RECEIVED' || po.status === 'PARTIAL') && (
            <Link to={`/delivery-orders/new?poId=${po.id}`} className="btn btn-primary">Record Delivery</Link>
          )}
          {!['CANCELLED', 'CLOSED'].includes(po.status) && (
            <button className="btn btn-danger" onClick={() => doAction('cancel')} disabled={!!acting}>
              {acting === 'cancel' ? 'Cancelling…' : 'Cancel PO'}
            </button>
          )}
          <Link to="/purchase-orders" className="btn btn-outline">← Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Info cards ── */}
      <div className="info-card-grid">
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--navy)', fontSize: 13 }}>PO DETAILS</div>
          <DetailRow label="Supplier">{po.supplier?.companyName} ({po.supplier?.supplierCode})</DetailRow>
          <DetailRow label="PO Date">{fmtDate(po.orderDate)}</DetailRow>
          <DetailRow label="Expected Delivery">{fmtDate(po.expectedDeliveryDate)}</DetailRow>
          <DetailRow label="Notes">{po.notes}</DetailRow>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--navy)', fontSize: 13 }}>FINANCIALS</div>
          <DetailRow label="Subtotal">{fmt(subtotal)}</DetailRow>
          <DetailRow label="GST (9%)">{fmt(gstAmount)}</DetailRow>
          <DetailRow label="Total">
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>{fmt(total)}</span>
          </DetailRow>
          {po.deliveryOrders?.length > 0 && (
            <DetailRow label="Deliveries received">{po.deliveryOrders.length}</DetailRow>
          )}
        </div>
      </div>

      {/* ── Line items ── */}
      <div className="card" style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-200)', fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
          LINE ITEMS
        </div>
        <div className="table-container" style={{ boxShadow: 'none', borderRadius: 0, margin: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Item Code</th>
                <th style={{ textAlign: 'right' }}>Qty Ordered</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Qty Received</th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20 }}>No line items</td></tr>
              ) : (po.items || []).map((item, idx) => {
                const received = parseFloat(item.quantityReceived || 0);
                const ordered  = parseFloat(item.quantity || 0);
                const pct      = ordered > 0 ? received / ordered : 0;
                return (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>{item.description}</td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.itemCode || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{Number(item.quantity).toLocaleString('en-SG')}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(item.unitPrice)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ color: pct >= 1 ? 'var(--green)' : pct > 0 ? 'var(--amber)' : 'var(--gray-400)' }}>
                        {Number(received).toLocaleString('en-SG')} / {Number(ordered).toLocaleString('en-SG')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Delivery orders ── */}
      {po.deliveryOrders?.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-200)', fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
            DELIVERY ORDERS
          </div>
          <div className="table-container" style={{ boxShadow: 'none', borderRadius: 0, margin: 0 }}>
            <table className="table">
              <thead>
                <tr><th>DO #</th><th>Delivery Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {po.deliveryOrders.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.doNumber}</td>
                    <td>{fmtDate(d.deliveryDate)}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td>
                      <Link to={`/delivery-orders/${d.id}`} className="btn btn-sm btn-outline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
