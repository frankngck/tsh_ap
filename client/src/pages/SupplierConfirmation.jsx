import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};
const fmt = (n) => `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

const daysSince = (iso) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

// ─── Email preview panel ──────────────────────────────────────────
function EmailPreview({ po, onConfirm, onReject, acting }) {
  if (!po) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>No PO selected</p>
        <p style={{ fontSize: 13 }}>Click a pending PO in the tracker to preview the supplier email.</p>
      </div>
    );
  }

  const itemCount = po.itemCount ?? po.items?.length ?? '—';

  return (
    <div className="card" style={{ overflow: 'visible' }}>
      {/* Email header bar */}
      <div style={{
        background: 'var(--navy)',
        color: 'white',
        padding: '16px 20px',
        borderRadius: 'var(--radius) var(--radius) 0 0',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.6, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          📧 Email Preview
        </div>
        {[
          ['From',    'TSH Synergy <purchasing@tshsynergy.com>'],
          ['To',      po.supplier?.email || 'supplier@email.com'],
          ['Subject', `Purchase Order ${po.poNumber} — Action Required`],
        ].map(([label, val]) => (
          <div key={label} style={{ fontSize: 12, lineHeight: 2 }}>
            <span style={{ opacity: 0.55, minWidth: 56, display: 'inline-block' }}>{label}:</span>
            <span style={{ opacity: 0.9 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Email body */}
      <div style={{ padding: '28px 28px 20px' }}>
        <p style={{ fontSize: 14, lineHeight: 1.75, marginBottom: 14 }}>
          Dear <strong>{po.supplier?.contactPerson || 'Sir / Madam'}</strong>,
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.75, marginBottom: 14 }}>
          Please find attached{' '}
          <strong>Purchase Order {po.poNumber}</strong> for{' '}
          <strong>{itemCount} item{itemCount !== 1 ? 's' : ''}</strong> totalling{' '}
          <strong>SGD {Number(po.total || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}</strong>.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.75, marginBottom: 14 }}>
          Expected delivery by: <strong>{fmtDate(po.expectedDeliveryDate)}</strong>
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}>
          Kindly confirm this purchase order at your earliest convenience. You may
          click the button below or contact our purchasing team directly.
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button
            style={{
              flex: 1, padding: '11px 0', background: 'var(--green)', color: 'white',
              border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14,
              fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer',
              opacity: acting ? 0.6 : 1, transition: 'opacity 0.15s',
            }}
            onClick={onConfirm}
            disabled={!!acting}
          >
            {acting === 'confirm' ? '…' : '✓  Confirm Order'}
          </button>
          <button
            style={{
              flex: 1, padding: '11px 0', background: 'var(--red)', color: 'white',
              border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14,
              fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer',
              opacity: acting ? 0.6 : 1, transition: 'opacity 0.15s',
            }}
            onClick={onReject}
            disabled={!!acting}
          >
            {acting === 'reject' ? '…' : '✕  Reject'}
          </button>
        </div>

        <div style={{
          fontSize: 12, color: 'var(--gray-400)', textAlign: 'center',
          borderTop: '1px solid var(--gray-100)', paddingTop: 14,
        }}>
          Supplier can confirm via email link or phone callback to +65 6XXX XXXX
        </div>
      </div>
    </div>
  );
}

// ─── Confirmation tracker table ───────────────────────────────────
function ConfirmationTracker({ orders, loading, selectedId, onSelect, onResend }) {
  if (loading) {
    return (
      <div className="card" style={{ padding: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 14, width: `${55 + i * 9}%`, borderRadius: 4, marginBottom: 18 }} />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>No pending confirmations</p>
        <p style={{ fontSize: 13 }}>All sent purchase orders have been confirmed.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table className="table">
        <thead>
          <tr>
            <th>PO #</th>
            <th>Supplier</th>
            <th>Sent Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((po) => {
            const days    = daysSince(po.updatedAt);
            const overdue = days > 3;
            const selected = selectedId === po.id;
            return (
              <tr
                key={po.id}
                style={{
                  cursor: 'pointer',
                  background: selected
                    ? 'var(--teal-light)'
                    : overdue
                    ? '#FFF7ED'
                    : undefined,
                  transition: 'background 0.1s',
                }}
                onClick={() => onSelect(po)}
              >
                <td style={{ fontWeight: 600, color: 'var(--teal)' }}>{po.poNumber}</td>
                <td style={{ fontSize: 13 }}>{po.supplier?.companyName}</td>
                <td>
                  <span style={{ fontSize: 12 }}>{fmtDate(po.updatedAt)}</span>
                  {overdue && (
                    <span style={{
                      display: 'block', fontSize: 11, fontWeight: 700,
                      color: 'var(--red)', marginTop: 2,
                    }}>
                      ⚠ {days}d overdue
                    </span>
                  )}
                </td>
                <td>
                  <span style={{
                    display: 'inline-block', padding: '2px 9px', borderRadius: 10,
                    fontSize: 11, fontWeight: 700,
                    background: overdue ? 'var(--red-light)' : 'var(--blue-light)',
                    color: overdue ? '#991B1B' : '#1E40AF',
                  }}>
                    {overdue ? 'OVERDUE' : 'PENDING'}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={(e) => { e.stopPropagation(); onResend(po); }}
                  >
                    Resend
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function SupplierConfirmation() {
  const [sentPOs,      setSentPOs]      = useState([]);
  const [selectedPO,   setSelectedPO]   = useState(null);  // full PO detail
  const [selectedId,   setSelectedId]   = useState(null);
  const [loadingList,  setLoadingList]  = useState(true);
  const [loadingDetail,setLoadingDetail]= useState(false);
  const [acting,       setActing]       = useState('');
  const [flash,        setFlash]        = useState('');
  const [flashType,    setFlashType]    = useState('success');
  const [error,        setError]        = useState('');

  const showFlash = (msg, type = 'success') => {
    setFlash(msg);
    setFlashType(type);
    setTimeout(() => setFlash(''), 4000);
  };

  const loadList = () => {
    setLoadingList(true);
    api.get('/purchase-orders?status=SENT')
      .then((r) => setSentPOs(r.data))
      .catch(() => setError('Failed to load pending confirmations.'))
      .finally(() => setLoadingList(false));
  };

  useEffect(() => { loadList(); }, []);

  const handleSelect = (po) => {
    setSelectedId(po.id);
    setLoadingDetail(true);
    api.get(`/purchase-orders/${po.id}`)
      .then((r) => setSelectedPO(r.data))
      .catch(() => showFlash('Failed to load PO details.', 'error'))
      .finally(() => setLoadingDetail(false));
  };

  const handleConfirm = async () => {
    if (!selectedPO) return;
    setActing('confirm');
    setError('');
    try {
      await api.put(`/purchase-orders/${selectedPO.id}/confirm`);
      showFlash(`✓ ${selectedPO.poNumber} confirmed by supplier`);
      setSelectedPO(null);
      setSelectedId(null);
      loadList();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to confirm PO.');
    } finally {
      setActing('');
    }
  };

  const handleReject = async () => {
    if (!selectedPO) return;
    setActing('reject');
    setError('');
    try {
      await api.put(`/purchase-orders/${selectedPO.id}/cancel`);
      showFlash(`${selectedPO.poNumber} rejected — PO cancelled`, 'error');
      setSelectedPO(null);
      setSelectedId(null);
      loadList();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject PO.');
    } finally {
      setActing('');
    }
  };

  const handleResend = (po) => {
    showFlash(`📧 Reminder email sent to ${po.supplier?.companyName}`);
  };

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Supplier Confirmation Tracker</h1>
          <div className="page-subtitle">
            {loadingList ? '' : `${sentPOs.length} PO${sentPOs.length !== 1 ? 's' : ''} awaiting supplier confirmation`}
          </div>
        </div>
        <Link to="/purchase-orders" className="btn btn-secondary">← Back to POs</Link>
      </div>

      {/* ── Flash / Error ── */}
      {flash && (
        <div className={`alert alert-${flashType === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>
          {flash}
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* ── Split screen ── */}
      <div className="split-screen">

        {/* LEFT — Supplier email view */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--gray-500)', marginBottom: 10 }}>
            Supplier View (Email / Portal)
          </div>
          {loadingDetail ? (
            <div className="card" style={{ padding: 32 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 14, width: `${50 + i * 8}%`, borderRadius: 4, marginBottom: 18 }} />
              ))}
            </div>
          ) : (
            <EmailPreview
              po={selectedPO}
              onConfirm={handleConfirm}
              onReject={handleReject}
              acting={acting}
            />
          )}
        </div>

        {/* RIGHT — AP System tracker */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--gray-500)', marginBottom: 10 }}>
            AP System — Confirmation Tracker
          </div>
          <ConfirmationTracker
            orders={sentPOs}
            loading={loadingList}
            selectedId={selectedId}
            onSelect={handleSelect}
            onResend={handleResend}
          />
        </div>

      </div>
    </div>
  );
}
