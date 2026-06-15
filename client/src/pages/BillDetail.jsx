import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────
const fmt = (n) =>
  `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};

const fmtDateTime = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-SG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const METHOD_LABEL = {
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE:        'Cheque',
  GIRO:          'GIRO',
  CASH:          'Cash',
  OTHER:         'Other',
};

// ─── Status badge ─────────────────────────────────────────────────
function StatusBadge({ status }) {
  return <span className={`badge badge-${status?.toLowerCase()}`}>{status}</span>;
}

// ─── Approve modal ────────────────────────────────────────────────
function ApproveModal({ bill, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Approve Bill</h3>
        </div>
        <div className="modal-body">
          <p>Approve <strong>{bill.billNumber}</strong>?</p>
          <p className="modal-warning">
            Total: {fmt(bill.total)} · Once approved, this bill can receive payments.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? <><span className="spinner" />Approving…</> : 'Approve Bill'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dispute modal ────────────────────────────────────────────────
function DisputeModal({ onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Dispute Bill</h3>
        </div>
        <div className="modal-body">
          <p>Mark this bill as <strong>DISPUTED</strong>?</p>
          <p className="modal-warning">Use this when amounts don't match the PO or items are incorrect.</p>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Reason (optional)</label>
            <textarea
              className="form-control"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Amounts don't match PO, incorrect items, etc."
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-danger" onClick={() => onConfirm(reason)} disabled={loading}>
            {loading ? <><span className="spinner" />Disputing…</> : 'Mark as Disputed'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail row ───────────────────────────────────────────────────
function DetailRow({ label, children }) {
  return (
    <div className="detail-row">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span style={{ color: 'var(--gray-300)' }}>—</span>}</div>
    </div>
  );
}

// ─── Skeleton loading ─────────────────────────────────────────────
function Sk({ w = '100%', h = 14, r = 4, mb = 0 }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, marginBottom: mb, display: 'block' }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function BillDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [bill,      setBill]      = useState(null);
  const [payments,  setPayments]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [actioning, setActioning] = useState(false);
  const [actionErr, setActionErr] = useState('');

  // Modal state
  const [showApprove, setShowApprove] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/bills/${id}`),
      api.get(`/payments/bill/${id}`).catch(() => ({ data: { payments: [] } })),
    ])
      .then(([b, p]) => {
        setBill(b.data);
        setPayments(p.data.payments || p.data || []);
      })
      .catch(() => setError('Bill not found.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async () => {
    setActioning(true);
    try {
      await api.patch(`/bills/${id}/approve`);
      setShowApprove(false);
      load();
    } catch (e) {
      setActionErr(e.response?.data?.message || 'Approve failed.');
      setShowApprove(false);
    } finally {
      setActioning(false);
    }
  };

  const handleDispute = async (reason) => {
    setActioning(true);
    try {
      await api.patch(`/bills/${id}/dispute`, { reason });
      setShowDispute(false);
      load();
    } catch (e) {
      setActionErr(e.response?.data?.message || 'Dispute failed.');
      setShowDispute(false);
    } finally {
      setActioning(false);
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <Sk w={200} h={28} mb={10} />
            <Sk w={120} h={20} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="card"><div className="card-body">
            {[1,2,3,4].map((i) => <div key={i} style={{ marginBottom: 16 }}><Sk w="45%" h={11} mb={6} /><Sk w="70%" h={14} /></div>)}
          </div></div>
          <div className="card"><div className="card-body">
            {[1,2,3].map((i) => <div key={i} style={{ marginBottom: 16 }}><Sk w="45%" h={11} mb={6} /><Sk w="70%" h={14} /></div>)}
          </div></div>
        </div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="loading">
        {error || 'Bill not found.'}&nbsp;
        <Link to="/bills">← Back to Bills</Link>
      </div>
    );
  }

  const outstanding = parseFloat(bill.total) - parseFloat(bill.amountPaid || 0);

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{bill.billNumber}</h1>
            <StatusBadge status={bill.status} />
          </div>
          <div className="page-subtitle">
            {bill.supplier?.companyName}
            {bill.billDate && ` · ${fmtDate(bill.billDate)}`}
          </div>
        </div>
      </div>

      {actionErr && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{actionErr}</div>
      )}

      {/* ── Info Row ── */}
      <div className="info-card-grid">

        {/* Supplier Info */}
        <div className="card">
          <div className="card-header"><span className="card-title">Supplier</span></div>
          <div className="card-body">
            <div className="detail-grid">
              <DetailRow label="Company">{bill.supplier?.companyName}</DetailRow>
              <DetailRow label="Code">{bill.supplier?.supplierCode}</DetailRow>
              <DetailRow label="Contact">{bill.supplier?.contactPerson}</DetailRow>
              <DetailRow label="Email">
                {bill.supplier?.email
                  ? <a href={`mailto:${bill.supplier.email}`} style={{ color: 'var(--teal)' }}>{bill.supplier.email}</a>
                  : null}
              </DetailRow>
            </div>
          </div>
        </div>

        {/* Bill Info */}
        <div className="card">
          <div className="card-header"><span className="card-title">Bill Information</span></div>
          <div className="card-body">
            <div className="detail-grid">
              {bill.purchaseOrder && (
                <DetailRow label="PO Number">{bill.purchaseOrder.poNumber}</DetailRow>
              )}
              <DetailRow label="Bill Date">{fmtDate(bill.billDate)}</DetailRow>
              <DetailRow label="Due Date">{fmtDate(bill.dueDate)}</DetailRow>
              <DetailRow label="Payment Terms">
                {bill.supplier?.paymentTerms ? `${bill.supplier.paymentTerms} days` : '—'}
              </DetailRow>
              {bill.approvedAt && (
                <DetailRow label="Approved At">{fmtDateTime(bill.approvedAt)}</DetailRow>
              )}
              {bill.disputeReason && (
                <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-label">Dispute Reason</div>
                  <div className="detail-value" style={{ color: 'var(--red)' }}>{bill.disputeReason}</div>
                </div>
              )}
              {bill.notes && (
                <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-label">Notes</div>
                  <div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{bill.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Line Items ── */}
      <div className="card section-gap">
        <div className="card-header">
          <span className="card-title">Line Items</span>
        </div>
        <div className="table-container" style={{ boxShadow: 'none', borderRadius: 0 }}>
          {(bill.items || []).length === 0 ? (
            <div className="empty-state"><p>No line items recorded.</p></div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>#</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(bill.items || []).map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>
                        {idx + 1}
                      </td>
                      <td>{item.description}</td>
                      <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(item.unitPrice)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ padding: '0 16px 20px' }}>
                <div className="totals-box">
                  <div className="totals-row">
                    <span>Subtotal</span>
                    <span>{fmt(bill.subtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>GST (9%)</span>
                    <span>{fmt(bill.gstAmount)}</span>
                  </div>
                  <div className="totals-row total-final">
                    <span>Total</span>
                    <span>{fmt(bill.total)}</span>
                  </div>
                  {parseFloat(bill.amountPaid) > 0 && (
                    <>
                      <div className="totals-row" style={{ color: 'var(--green)', fontWeight: 600 }}>
                        <span>Paid</span>
                        <span>{fmt(bill.amountPaid)}</span>
                      </div>
                      <div
                        className="totals-row"
                        style={{
                          color:      outstanding > 0 ? 'var(--red)' : 'var(--green)',
                          fontWeight: 700,
                          fontSize:   15,
                        }}
                      >
                        <span>Outstanding</span>
                        <span>{fmt(outstanding)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Payment History ── */}
      {payments.length > 0 && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title">Payment History</span>
            {bill.status === 'APPROVED' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => navigate(`/payments/new?billId=${id}`)}
              >
                + Record Payment
              </button>
            )}
          </div>
          <div className="table-container" style={{ boxShadow: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 13 }}>{fmtDate(p.paymentDate)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(p.amount)}</td>
                    <td style={{ fontSize: 13 }}>{METHOD_LABEL[p.paymentMethod] || p.paymentMethod}</td>
                    <td style={{ fontSize: 13 }}>{p.reference || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Action Buttons (bottom) ── */}
      <div className="form-actions" style={{ marginTop: 32 }}>
        <Link to="/bills" className="btn btn-secondary">← Back</Link>

        {bill.status === 'RECEIVED' && (
          <button
            className="btn btn-danger"
            onClick={() => setShowDispute(true)}
            disabled={actioning}
          >
            Dispute
          </button>
        )}

        {bill.status === 'RECEIVED' && (
          <button
            className="btn btn-primary"
            onClick={() => setShowApprove(true)}
            disabled={actioning}
          >
            Approve
          </button>
        )}

        {bill.status === 'APPROVED' && (
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/payments/new?billId=${id}`)}
          >
            Record Payment
          </button>
        )}

        <button
          className="btn btn-outline"
          onClick={() => window.print()}
          style={{ marginLeft: 'auto' }}
        >
          Print
        </button>
      </div>

      {/* ── Modals ── */}
      {showApprove && (
        <ApproveModal
          bill={bill}
          onConfirm={handleApprove}
          onCancel={() => setShowApprove(false)}
          loading={actioning}
        />
      )}
      {showDispute && (
        <DisputeModal
          onConfirm={handleDispute}
          onCancel={() => setShowDispute(false)}
          loading={actioning}
        />
      )}
    </div>
  );
}
