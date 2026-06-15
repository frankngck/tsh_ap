import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const addDays = (dateStr, days) => {
  const p = dateStr.split('-');
  const d = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2])+days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const GST_RATE = 0.09;

const emptyItem = () => ({ description: '', itemCode: '', quantity: '', unitPrice: '' });

function FieldError({ msg }) {
  if (!msg) return null;
  return <span className="field-error">{msg}</span>;
}

// ─── Main component ───────────────────────────────────────────────
export default function PurchaseOrderForm() {
  const navigate = useNavigate();
  const { id }   = useParams();
  const isEdit   = Boolean(id);

  const [suppliers, setSuppliers]   = useState([]);
  const [loadError, setLoadError]   = useState('');
  const [loading,   setLoading]     = useState(isEdit);
  const [saving,    setSaving]      = useState(false);
  const [apiError,  setApiError]    = useState('');
  const [errors,    setErrors]      = useState({});

  const today = todayStr();
  const [form, setForm] = useState({
    supplierId:           '',
    orderDate:            today,
    expectedDeliveryDate: addDays(today, 30),
    notes:                '',
  });
  const [items, setItems] = useState([emptyItem()]);

  // ── Load data ─────────────────────────────────────────────────
  useEffect(() => {
    api.get('/suppliers')
      .then((r) => setSuppliers(r.data))
      .catch(() => setLoadError('Failed to load suppliers.'));

    if (isEdit) {
      api.get(`/purchase-orders/${id}`)
        .then((r) => {
          const po = r.data;
          setForm({
            supplierId:           String(po.supplierId || ''),
            orderDate:            String(po.orderDate || '').slice(0, 10),
            expectedDeliveryDate: String(po.expectedDeliveryDate || '').slice(0, 10),
            notes:                po.notes || '',
          });
          setItems(
            (po.items || []).length > 0
              ? po.items.map((i) => ({
                  description: i.description || '',
                  itemCode:    i.itemCode    || '',
                  quantity:    String(i.quantity),
                  unitPrice:   String(i.unitPrice),
                }))
              : [emptyItem()]
          );
        })
        .catch(() => setLoadError('Failed to load purchase order.'))
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Field helpers ──────────────────────────────────────────────
  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const setItemField = (idx, k, v) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [k]: v } : item));
    if (errors[`item_${idx}_${k}`]) setErrors((e) => ({ ...e, [`item_${idx}_${k}`]: '' }));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // ── Computed totals ────────────────────────────────────────────
  const lineAmounts = items.map((i) => {
    const qty = parseFloat(i.quantity) || 0;
    const up  = parseFloat(i.unitPrice) || 0;
    return qty * up;
  });
  const subtotal  = lineAmounts.reduce((a, b) => a + b, 0);
  const gstAmount = subtotal * GST_RATE;
  const total     = subtotal + gstAmount;

  // ── Validation ─────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.supplierId) e.supplierId = 'Please select a supplier.';
    if (!form.orderDate)  e.orderDate  = 'PO date is required.';
    items.forEach((item, idx) => {
      if (!item.description.trim()) e[`item_${idx}_description`] = 'Description required.';
      if (!item.quantity || parseFloat(item.quantity) <= 0) e[`item_${idx}_quantity`] = 'Enter valid qty.';
      if (!item.unitPrice || parseFloat(item.unitPrice) <= 0) e[`item_${idx}_unitPrice`] = 'Enter valid price.';
    });
    if (items.length === 0) e.items = 'Add at least one line item.';
    return e;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e, sendAfter = false) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setApiError('');
    setSaving(true);
    try {
      const payload = {
        supplierId:           Number(form.supplierId),
        orderDate:            form.orderDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        notes:                form.notes || undefined,
        items: items.map((i) => ({
          description: i.description,
          itemCode:    i.itemCode || undefined,
          quantity:    parseFloat(i.quantity),
          unitPrice:   parseFloat(i.unitPrice),
        })),
      };

      let po;
      if (isEdit) {
        const r = await api.put(`/purchase-orders/${id}`, payload);
        po = r.data;
      } else {
        const r = await api.post('/purchase-orders', payload);
        po = r.data;
      }

      if (sendAfter && po?.id) {
        await api.put(`/purchase-orders/${po.id}/send`);
      }

      navigate('/purchase-orders');
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to save purchase order.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="skeleton" style={{ height: 28, width: 260, borderRadius: 4 }} />
        </div>
        <div className="form-card" style={{ padding: 32 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 16, width: `${60 + i * 5}%`, borderRadius: 4, marginBottom: 20 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Purchase Order' : 'Create Purchase Order'}</h1>
          <div className="page-subtitle">
            {isEdit ? `Editing PO — changes update subtotal and GST automatically` : 'Fill in the details below to create a new PO'}
          </div>
        </div>
        <Link to="/purchase-orders" className="btn btn-secondary">← Back to POs</Link>
      </div>

      {loadError && <div className="alert alert-error" style={{ marginBottom: 20 }}>{loadError}</div>}
      {apiError  && <div className="alert alert-error" style={{ marginBottom: 20 }}>{apiError}</div>}

      <form className="form-card sf-form" onSubmit={(e) => handleSubmit(e, false)} noValidate>

        {/* ── TOP SECTION ── */}
        <div className="sf-section-label">Purchase Order Details</div>

        <div className="sf-grid" style={{ marginBottom: 24 }}>
          <div className="sf-col">

            {/* PO Number */}
            <div className="form-group">
              <label className="form-label">PO Number</label>
              <input
                className="form-control"
                value={isEdit ? '(editing existing PO)' : 'Auto-generated on save'}
                readOnly
                style={{ background: 'var(--gray-100)', color: 'var(--gray-500)', cursor: 'default' }}
              />
            </div>

            {/* Supplier */}
            <div className="form-group">
              <label className="form-label">Supplier <span className="req">*</span></label>
              <select
                className={`form-control${errors.supplierId ? ' input-error' : ''}`}
                value={form.supplierId}
                onChange={(e) => setField('supplierId', e.target.value)}
              >
                <option value="">— Select Supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.companyName}</option>
                ))}
              </select>
              <FieldError msg={errors.supplierId} />
            </div>

          </div>
          <div className="sf-col">

            {/* PO Date */}
            <div className="form-group">
              <label className="form-label">PO Date <span className="req">*</span></label>
              <input
                type="date"
                className={`form-control${errors.orderDate ? ' input-error' : ''}`}
                value={form.orderDate}
                onChange={(e) => setField('orderDate', e.target.value)}
                style={{ maxWidth: 200 }}
              />
              <FieldError msg={errors.orderDate} />
            </div>

            {/* Expected Delivery */}
            <div className="form-group">
              <label className="form-label">Expected Delivery Date</label>
              <input
                type="date"
                className="form-control"
                value={form.expectedDeliveryDate}
                onChange={(e) => setField('expectedDeliveryDate', e.target.value)}
                style={{ maxWidth: 200 }}
              />
            </div>

          </div>
        </div>

        {/* ── LINE ITEMS ── */}
        <div className="sf-section-label" style={{ marginBottom: 12 }}>Line Items</div>

        {errors.items && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errors.items}</div>}

        <div className="table-container" style={{ marginBottom: 0, boxShadow: 'none', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Description <span className="req">*</span></th>
                <th style={{ width: 110 }}>Item Code</th>
                <th style={{ width: 90 }}>Qty <span className="req">*</span></th>
                <th style={{ width: 120 }}>Unit Price <span className="req">*</span></th>
                <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const amt = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
                return (
                  <tr key={idx}>
                    <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{idx + 1}</td>
                    <td>
                      <input
                        className={`form-control${errors[`item_${idx}_description`] ? ' input-error' : ''}`}
                        value={item.description}
                        onChange={(e) => setItemField(idx, 'description', e.target.value)}
                        placeholder="Item description"
                        style={{ marginBottom: 0 }}
                      />
                      <FieldError msg={errors[`item_${idx}_description`]} />
                    </td>
                    <td>
                      <input
                        className="form-control"
                        value={item.itemCode}
                        onChange={(e) => setItemField(idx, 'itemCode', e.target.value)}
                        placeholder="Optional"
                        style={{ marginBottom: 0 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className={`form-control${errors[`item_${idx}_quantity`] ? ' input-error' : ''}`}
                        value={item.quantity}
                        onChange={(e) => setItemField(idx, 'quantity', e.target.value)}
                        min="0.01"
                        step="0.01"
                        placeholder="0"
                        style={{ marginBottom: 0 }}
                      />
                      <FieldError msg={errors[`item_${idx}_quantity`]} />
                    </td>
                    <td>
                      <input
                        type="number"
                        className={`form-control${errors[`item_${idx}_unitPrice`] ? ' input-error' : ''}`}
                        value={item.unitPrice}
                        onChange={(e) => setItemField(idx, 'unitPrice', e.target.value)}
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        style={{ marginBottom: 0 }}
                      />
                      <FieldError msg={errors[`item_${idx}_unitPrice`]} />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gray-700)', fontSize: 13 }}>
                      {amt > 0 ? `S$${amt.toLocaleString('en-SG', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="btn-icon-remove"
                          onClick={() => removeItem(idx)}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={addItem}
          style={{ marginTop: 10, fontSize: 13 }}
        >
          + Add Item
        </button>

        {/* ── TOTALS ── */}
        <div style={{
          marginTop: 24,
          marginLeft: 'auto',
          width: 280,
          borderTop: '1px solid var(--gray-200)',
          paddingTop: 16,
        }}>
          {[
            { label: 'Subtotal',  value: subtotal },
            { label: `GST (${(GST_RATE * 100).toFixed(0)}%)`, value: gstAmount },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--gray-600)' }}>
              <span>{label}</span>
              <span>{`S$${value.toLocaleString('en-SG', { minimumFractionDigits: 2 })}`}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--navy)', borderTop: '2px solid var(--navy)', paddingTop: 10, marginTop: 4 }}>
            <span>Total</span>
            <span>{`S$${total.toLocaleString('en-SG', { minimumFractionDigits: 2 })}`}</span>
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="form-group" style={{ marginTop: 24, marginBottom: 0 }}>
          <label className="form-label">Notes</label>
          <textarea
            className="form-control"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            rows={3}
            placeholder="Additional notes for this purchase order (optional)"
          />
        </div>

        {/* ── ACTIONS ── */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-secondary"
            disabled={saving}
          >
            {saving ? <><span className="spinner" />Saving…</> : 'Save Draft'}
          </button>
          {!isEdit && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={(e) => handleSubmit(e, true)}
            >
              {saving ? <><span className="spinner" />Sending…</> : 'Save & Send to Supplier'}
            </button>
          )}
          <Link to="/purchase-orders" className="btn btn-outline" style={{ marginLeft: 'auto' }}>
            Cancel
          </Link>
        </div>

      </form>
    </div>
  );
}
