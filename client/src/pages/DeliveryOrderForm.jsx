import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const CONDITIONS = [
  { value: 'OK',       label: 'OK' },
  { value: 'SHORT',    label: 'Short' },
  { value: 'DAMAGED',  label: 'Damaged' },
  { value: 'REJECTED', label: 'Rejected' },
];

function FieldError({ msg }) {
  if (!msg) return null;
  return <span className="field-error">{msg}</span>;
}

// ─── Variance display ─────────────────────────────────────────────
function Variance({ received, outstanding }) {
  const r = parseFloat(received) || 0;
  const v = r - outstanding;
  if (r === 0 && outstanding > 0) return <span style={{ color: 'var(--gray-300)' }}>—</span>;
  if (Math.abs(v) < 0.001) return <span className="variance-ok">✓ 0</span>;
  if (v < 0) return <span className="variance-short">▼ {v.toLocaleString('en-SG')}</span>;
  return <span className="variance-excess">▲ +{v.toLocaleString('en-SG')}</span>;
}

// ─── Main component ───────────────────────────────────────────────
export default function DeliveryOrderForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPoId = searchParams.get('poId') || '';

  const [eligiblePOs,   setEligiblePOs]   = useState([]);
  const [selectedPoId,  setSelectedPoId]  = useState(preselectedPoId);
  const [poDetail,      setPoDetail]      = useState(null);
  const [loadingPOs,    setLoadingPOs]    = useState(true);
  const [loadingItems,  setLoadingItems]  = useState(false);

  const [form, setForm] = useState({
    deliveryDate: todayStr(),
    receivedBy:   '',
    notes:        '',
  });
  const [items,    setItems]    = useState([]);
  const [errors,   setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [saving,   setSaving]   = useState(false);

  // ── Load CONFIRMED + PARTIAL POs ──────────────────────────────
  useEffect(() => {
    setLoadingPOs(true);
    Promise.all([
      api.get('/purchase-orders?status=RECEIVED'),
      api.get('/purchase-orders?status=PARTIAL'),
    ])
      .then(([r1, r2]) => {
        const combined = [...r1.data, ...r2.data].sort((a, b) =>
          a.poNumber.localeCompare(b.poNumber)
        );
        setEligiblePOs(combined);
      })
      .catch(() => setApiError('Failed to load purchase orders.'))
      .finally(() => setLoadingPOs(false));
  }, []);

  // ── Load PO items when PO selection changes ───────────────────
  useEffect(() => {
    if (!selectedPoId) { setPoDetail(null); setItems([]); return; }
    setLoadingItems(true);
    setErrors({});
    api.get(`/purchase-orders/${selectedPoId}`)
      .then((r) => {
        setPoDetail(r.data);
        setItems(
          (r.data.items || []).map((i) => {
            const ordered  = parseFloat(i.quantity || 0);
            const received = parseFloat(i.quantityReceived || 0);
            const outstanding = Math.max(0, ordered - received);
            return {
              purchaseOrderItemId: i.id,
              description:         i.description,
              itemCode:            i.itemCode || '',
              poQty:               ordered,
              alreadyReceived:     received,
              outstanding,
              receivedQty:         String(outstanding),
              condition:           'OK',
              notes:               '',
            };
          })
        );
      })
      .catch(() => setApiError('Failed to load PO items.'))
      .finally(() => setLoadingItems(false));
  }, [selectedPoId]);

  // ── Item field setter ─────────────────────────────────────────
  const setItemField = (idx, k, v) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [k]: v } : item))
    );
    if (errors[`item_${idx}`]) setErrors((e) => ({ ...e, [`item_${idx}`]: '' }));
  };

  // ── Summary stats ─────────────────────────────────────────────
  const totalOutstanding = items.reduce((s, i) => s + i.outstanding, 0);
  const totalNowReceiving = items.reduce((s, i) => s + (parseFloat(i.receivedQty) || 0), 0);
  const fullyReceived = totalOutstanding > 0 && totalNowReceiving >= totalOutstanding;

  // ── Validation ────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!selectedPoId) e.poId = 'Please select a Purchase Order.';
    if (!form.deliveryDate) e.deliveryDate = 'Receipt date is required.';
    items.forEach((item, idx) => {
      const qty = parseFloat(item.receivedQty);
      if (item.receivedQty !== '' && (isNaN(qty) || qty < 0))
        e[`item_${idx}`] = 'Invalid quantity.';
    });
    const anyReceived = items.some((i) => parseFloat(i.receivedQty) > 0);
    if (!anyReceived) e.items = 'At least one item must have a received quantity.';
    return e;
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setApiError('');
    try {
      const noteParts = [
        form.receivedBy ? `Received by: ${form.receivedBy}` : '',
        form.notes      ? form.notes : '',
      ].filter(Boolean);

      const payload = {
        purchaseOrderId: Number(selectedPoId),
        deliveryDate:    form.deliveryDate,
        notes:           noteParts.join(' | ') || undefined,
        items: items
          .filter((i) => parseFloat(i.receivedQty) > 0)
          .map((i) => ({
            purchaseOrderItemId: i.purchaseOrderItemId,
            description:         i.description,
            quantity:            parseFloat(i.receivedQty),
          })),
      };

      await api.post('/delivery-orders', payload);
      navigate('/purchase-orders');
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to save goods receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Goods Receipt — Record Delivery</h1>
          <div className="page-subtitle">Record quantities received against a Purchase Order</div>
        </div>
        <Link to="/purchase-orders" className="btn btn-secondary">← Back to POs</Link>
      </div>

      {apiError && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>{apiError}</div>
      )}

      <form onSubmit={handleSubmit} noValidate>

        {/* ── TOP SECTION ── */}
        <div className="form-card sf-form" style={{ marginBottom: 20 }}>
          <div className="sf-section-label">Receipt Details</div>

          <div className="sf-grid" style={{ marginBottom: 0 }}>
            <div className="sf-col">

              {/* PO Reference */}
              <div className="form-group">
                <label className="form-label">
                  PO Reference <span className="req">*</span>
                </label>
                {loadingPOs ? (
                  <div className="skeleton" style={{ height: 38, borderRadius: 6 }} />
                ) : (
                  <select
                    className={`form-control${errors.poId ? ' input-error' : ''}`}
                    value={selectedPoId}
                    onChange={(e) => setSelectedPoId(e.target.value)}
                  >
                    <option value="">— Select Purchase Order —</option>
                    {eligiblePOs.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber} — {po.supplier?.companyName}
                        {po.status === 'PARTIAL' ? ' (partial)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                <FieldError msg={errors.poId} />
                {eligiblePOs.length === 0 && !loadingPOs && (
                  <div className="form-hint">
                    No confirmed POs available.{' '}
                    <Link to="/purchase-orders" style={{ color: 'var(--teal)' }}>Go to POs →</Link>
                  </div>
                )}
              </div>

              {/* DO Number */}
              <div className="form-group">
                <label className="form-label">DO Number</label>
                <input
                  className="form-control"
                  value="Auto-generated on save"
                  readOnly
                  style={{ background: 'var(--gray-100)', color: 'var(--gray-500)', cursor: 'default' }}
                />
              </div>

            </div>
            <div className="sf-col">

              {/* Receipt Date */}
              <div className="form-group">
                <label className="form-label">
                  Receipt Date <span className="req">*</span>
                </label>
                <input
                  type="date"
                  className={`form-control${errors.deliveryDate ? ' input-error' : ''}`}
                  value={form.deliveryDate}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))}
                  style={{ maxWidth: 200 }}
                />
                <FieldError msg={errors.deliveryDate} />
              </div>

              {/* Received By */}
              <div className="form-group">
                <label className="form-label">Received By</label>
                <input
                  className="form-control"
                  value={form.receivedBy}
                  onChange={(e) => setForm((f) => ({ ...f, receivedBy: e.target.value }))}
                  placeholder="Staff name (optional)"
                />
              </div>

            </div>
          </div>

          {/* PO summary strip */}
          {poDetail && (
            <div style={{
              marginTop: 20,
              padding: '12px 16px',
              background: 'var(--teal-light)',
              border: '1px solid #99F6E4',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              display: 'flex',
              gap: 28,
              flexWrap: 'wrap',
            }}>
              <span><strong>{poDetail.poNumber}</strong> · {poDetail.supplier?.companyName}</span>
              <span>PO Date: <strong>{fmtDate(poDetail.orderDate)}</strong></span>
              <span>Expected: <strong>{fmtDate(poDetail.expectedDeliveryDate)}</strong></span>
              <span>PO Total: <strong>S${Number(poDetail.total || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}</strong></span>
            </div>
          )}
        </div>

        {/* ── ITEMS TABLE ── */}
        {selectedPoId && (
          <div className="form-card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-200)', fontWeight: 700, fontSize: 13, color: 'var(--navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>ITEMS RECEIVED</span>
              {errors.items && <span style={{ color: 'var(--red)', fontSize: 12, fontWeight: 400 }}>{errors.items}</span>}
            </div>

            {loadingItems ? (
              <div style={{ padding: 24 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 14, width: `${50 + i * 10}%`, borderRadius: 4, marginBottom: 16 }} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>
                No line items found on this PO.
              </div>
            ) : (
              <div className="table-container" style={{ boxShadow: 'none', borderRadius: 0, margin: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>#</th>
                      <th>Item</th>
                      <th style={{ width: 90, textAlign: 'right' }}>PO Qty</th>
                      <th style={{ width: 90, textAlign: 'right' }}>Already Rcvd</th>
                      <th style={{ width: 120, textAlign: 'right' }}>Outstanding</th>
                      <th style={{ width: 130 }}>Received Qty <span className="req">*</span></th>
                      <th style={{ width: 90, textAlign: 'center' }}>Variance</th>
                      <th style={{ width: 120 }}>Condition</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.purchaseOrderItemId} style={{ background: parseFloat(item.receivedQty) >= item.outstanding && item.outstanding > 0 ? '#F0FDF4' : undefined }}>
                        <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{item.description}</div>
                          {item.itemCode && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{item.itemCode}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>
                          {item.poQty.toLocaleString('en-SG')}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 13, color: item.alreadyReceived > 0 ? 'var(--green)' : 'var(--gray-300)' }}>
                          {item.alreadyReceived > 0 ? item.alreadyReceived.toLocaleString('en-SG') : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: item.outstanding > 0 ? 'var(--amber)' : 'var(--green)' }}>
                          {item.outstanding > 0 ? item.outstanding.toLocaleString('en-SG') : '✓ Complete'}
                        </td>
                        <td>
                          <input
                            type="number"
                            className={`form-control${errors[`item_${idx}`] ? ' input-error' : ''}`}
                            value={item.receivedQty}
                            onChange={(e) => setItemField(idx, 'receivedQty', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0"
                            style={{ marginBottom: 0, maxWidth: 110 }}
                          />
                          <FieldError msg={errors[`item_${idx}`]} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Variance received={item.receivedQty} outstanding={item.outstanding} />
                        </td>
                        <td>
                          <select
                            className="form-control"
                            value={item.condition}
                            onChange={(e) => setItemField(idx, 'condition', e.target.value)}
                            style={{ marginBottom: 0, fontSize: 12 }}
                          >
                            {CONDITIONS.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="form-control"
                            value={item.notes}
                            onChange={(e) => setItemField(idx, 'notes', e.target.value)}
                            placeholder="Remarks…"
                            style={{ marginBottom: 0, fontSize: 12 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Receipt status summary ── */}
            {items.length > 0 && (
              <div style={{ padding: '0 0 0 0' }}>
                <div className={`receipt-status ${fullyReceived ? 'full' : 'partial'}`}>
                  <span style={{ fontSize: 18 }}>{fullyReceived ? '✅' : '⚠️'}</span>
                  <span>
                    {fullyReceived
                      ? `FULLY RECEIVED — all ${totalOutstanding.toLocaleString('en-SG')} units accounted for`
                      : `PARTIALLY RECEIVED — ${totalNowReceiving.toLocaleString('en-SG')} of ${totalOutstanding.toLocaleString('en-SG')} units`}
                  </span>
                  <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 13, opacity: 0.8 }}>
                    {totalOutstanding > 0
                      ? `${Math.round((totalNowReceiving / totalOutstanding) * 100)}% complete`
                      : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Notes ── */}
        <div className="form-card sf-form" style={{ marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Additional Notes</label>
            <textarea
              className="form-control"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Delivery condition, carrier name, remarks… (optional)"
            />
          </div>
        </div>

        {/* ── ACTIONS ── */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !selectedPoId || items.length === 0}
          >
            {saving ? <><span className="spinner" />Saving…</> : 'Save Goods Receipt'}
          </button>
          <Link to="/purchase-orders" className="btn btn-outline" style={{ marginLeft: 'auto' }}>
            Cancel
          </Link>
        </div>

      </form>
    </div>
  );
}
