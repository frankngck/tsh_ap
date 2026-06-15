import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

// ─── Constants ────────────────────────────────────────────────────
const GST = 0.09;

// ─── Helpers ──────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const addDaysStr = (dateStr, n) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const fmt = (n) =>
  `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

// ─── Inline field error ───────────────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return <span className="field-error">{msg}</span>;
}

// ─── Empty line item ──────────────────────────────────────────────
const EMPTY_ITEM = { description: '', quantity: '1', unitPrice: '', amount: 0 };

// ─── Main component ───────────────────────────────────────────────
export default function BillForm() {
  const navigate = useNavigate();

  const [suppliers,    setSuppliers]    = useState([]);
  const [pos,          setPos]          = useState([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [doOptions,    setDoOptions]    = useState([]);
  const [selectedDoId, setSelectedDoId] = useState('');
  const [form, setForm] = useState({
    supplierId: '',
    billDate:   todayStr(),
    dueDate:    addDaysStr(todayStr(), 30),
    notes:      '',
  });
  const [items,    setItems]    = useState([{ ...EMPTY_ITEM }]);
  const [errors,   setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [saving,   setSaving]   = useState(null); // null | 'RECEIVED' | 'APPROVED'

  // ── Load suppliers + POs ───────────────────────────────────────
  useEffect(() => {
    api.get('/suppliers').then((r) => setSuppliers(r.data));
    api.get('/purchase-orders').then((r) => setPos(r.data)).catch(() => {});
  }, []);

  // ── When PO selected: auto-fill supplier + load linked DOs ────
  const onPoChange = (poId) => {
    setSelectedPoId(poId);
    setSelectedDoId('');
    setDoOptions([]);
    if (!poId) return;
    const po = pos.find((p) => String(p.id) === String(poId));
    if (po?.supplierId) {
      const supId = String(po.supplierId);
      setForm((f) => {
        const s = suppliers.find((x) => String(x.id) === supId);
        return { ...f, supplierId: supId, dueDate: addDaysStr(f.billDate, s?.paymentTerms || 30) };
      });
    }
    api.get(`/purchase-orders/${poId}`)
      .then((r) => setDoOptions(r.data.deliveryOrders || []))
      .catch(() => {});
  };

  // ── Field setter ───────────────────────────────────────────────
  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  // ── Supplier change: auto-update due date ──────────────────────
  const onSupplierChange = (id) => {
    setField('supplierId', id);
    const s = suppliers.find((x) => String(x.id) === String(id));
    if (s) setForm((f) => ({ ...f, supplierId: id, dueDate: addDaysStr(f.billDate, s.paymentTerms || 30) }));
  };

  // ── Bill date change: recalculate due date ─────────────────────
  const onBillDateChange = (val) => {
    const s = suppliers.find((x) => String(x.id) === String(form.supplierId));
    const terms = s?.paymentTerms || 30;
    setForm((f) => ({ ...f, billDate: val, dueDate: addDaysStr(val, terms) }));
  };

  // ── Line item helpers ──────────────────────────────────────────
  const updateItem = (i, k, v) => {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [k]: v };
      if (k === 'quantity' || k === 'unitPrice') {
        next[i].amount =
          parseFloat(next[i].quantity || 0) * parseFloat(next[i].unitPrice || 0);
      }
      return next;
    });
    if (errors.items) setErrors((e) => ({ ...e, items: '' }));
  };

  const addItem    = () => setItems((p) => [...p, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i));

  // ── Totals ─────────────────────────────────────────────────────
  const subtotal = items.reduce((s, it) => s + (it.amount || 0), 0);
  const gstAmt   = subtotal * GST;
  const total    = subtotal + gstAmt;

  // ── Validation ─────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.supplierId) e.supplierId = 'Please select a supplier.';
    if (!form.billDate)   e.billDate   = 'Bill date is required.';
    if (!form.dueDate)    e.dueDate    = 'Due date is required.';
    if (items.every((i) => !i.description.trim()))
      e.items = 'Add at least one line item with a description.';
    return e;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (status) => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setApiError('');
    setSaving(status);

    try {
      const payload = {
        supplierId:      Number(form.supplierId),
        billDate:        form.billDate,
        dueDate:         form.dueDate,
        status,
        notes:           form.notes.trim() || undefined,
        purchaseOrderId: selectedPoId ? Number(selectedPoId) : undefined,
        deliveryOrderId: selectedDoId ? Number(selectedDoId) : undefined,
        items: items
          .filter((i) => i.description.trim())
          .map((i) => ({
            description: i.description,
            quantity:    parseFloat(i.quantity) || 1,
            unitPrice:   parseFloat(i.unitPrice) || 0,
            amount:      parseFloat(i.amount)    || 0,
          })),
      };

      const r = await api.post('/bills', payload);
      navigate(`/bills/${r.data.id}`);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to save bill. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const isSaving = saving !== null;

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Record Supplier Bill</h1>
          <div className="page-subtitle">Bill number is assigned automatically on save</div>
        </div>
        <Link to="/bills" className="btn btn-secondary">← Back to Bills</Link>
      </div>

      {apiError && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>{apiError}</div>
      )}

      <div className="form-card sf-form">
        {/* ── Section: Bill Details ── */}
        <div className="sf-section-label">Bill Details</div>

        {/* ── 2-column top grid ── */}
        <div className="sf-grid" style={{ marginBottom: 24 }}>

          {/* LEFT COLUMN */}
          <div className="sf-col">

            {/* Bill Number (read-only) */}
            <div className="form-group">
              <label className="form-label">Bill Number</label>
              <input
                className="form-control"
                value=""
                placeholder="Auto-generated (e.g. BIL-006)"
                disabled
                readOnly
              />
            </div>

            {/* Supplier */}
            <div className="form-group">
              <label className="form-label">
                Supplier <span className="req">*</span>
              </label>
              <select
                className={`form-control${errors.supplierId ? ' input-error' : ''}`}
                value={form.supplierId}
                onChange={(e) => onSupplierChange(e.target.value)}
              >
                <option value="">— Select Supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplierCode} – {s.companyName}
                  </option>
                ))}
              </select>
              <FieldError msg={errors.supplierId} />
            </div>

            {/* Link to PO */}
            <div className="form-group">
              <label className="form-label">Link to PO</label>
              <select
                className="form-control"
                value={selectedPoId}
                onChange={(e) => onPoChange(e.target.value)}
              >
                <option value="">— No PO link (optional) —</option>
                {pos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — {po.supplier?.companyName}
                  </option>
                ))}
              </select>
              <div className="form-hint">Linking a PO enables 3-way match verification</div>
            </div>

            {/* Link to DO */}
            <div className="form-group">
              <label className="form-label">Link to Delivery Order</label>
              <select
                className="form-control"
                value={selectedDoId}
                onChange={(e) => setSelectedDoId(e.target.value)}
                disabled={!selectedPoId || doOptions.length === 0}
              >
                <option value="">— No DO link (optional) —</option>
                {doOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.doNumber} · {d.deliveryDate ? d.deliveryDate.slice(0,10) : ''} [{d.status}]
                  </option>
                ))}
              </select>
              {selectedPoId && doOptions.length === 0 && (
                <div className="form-hint">No delivery orders on this PO yet</div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="sf-col">

            {/* Bill Date */}
            <div className="form-group">
              <label className="form-label">
                Bill Date <span className="req">*</span>
              </label>
              <input
                type="date"
                className={`form-control${errors.billDate ? ' input-error' : ''}`}
                value={form.billDate}
                onChange={(e) => onBillDateChange(e.target.value)}
                style={{ maxWidth: 200 }}
              />
              <FieldError msg={errors.billDate} />
            </div>

            {/* Due Date */}
            <div className="form-group">
              <label className="form-label">
                Due Date <span className="req">*</span>
              </label>
              <input
                type="date"
                className={`form-control${errors.dueDate ? ' input-error' : ''}`}
                value={form.dueDate}
                onChange={(e) => setField('dueDate', e.target.value)}
                style={{ maxWidth: 200 }}
              />
              <FieldError msg={errors.dueDate} />
              {form.supplierId && (
                <div className="form-hint">
                  Based on supplier payment terms
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Section: Line Items ── */}
        <div className="sf-section-label">Line Items</div>

        {errors.items && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>{errors.items}</div>
        )}

        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>#</th>
                <th>Description</th>
                <th style={{ width: 90 }}>Qty</th>
                <th style={{ width: 130 }}>Unit Price (S$)</th>
                <th style={{ width: 130, textAlign: 'right' }}>Amount (S$)</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>
                    {i + 1}
                  </td>
                  <td>
                    <input
                      className="form-control"
                      value={item.description}
                      onChange={(e) => updateItem(i, 'description', e.target.value)}
                      placeholder="Item description"
                    />
                  </td>
                  <td>
                    <input
                      className="form-control"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, 'unitPrice', e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500, paddingRight: 12, whiteSpace: 'nowrap' }}>
                    {fmt(item.amount || 0)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="btn-icon-remove"
                        onClick={() => removeItem(i)}
                        title="Remove row"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={addItem}
          style={{ marginBottom: 24 }}
        >
          + Add Line Item
        </button>

        {/* ── Totals ── */}
        <div className="totals-box">
          <div className="totals-row">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="totals-row">
            <span>GST (9%)</span>
            <span>{fmt(gstAmt)}</span>
          </div>
          <div className="totals-row total-final">
            <span>Total</span>
            <span>{fmt(total)}</span>
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="form-group" style={{ marginTop: 24 }}>
          <label className="form-label">Notes</label>
          <textarea
            className="form-control"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            rows={3}
            placeholder="Additional notes or remarks (optional)"
          />
        </div>

        {/* ── Actions ── */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isSaving}
            onClick={() => handleSubmit('RECEIVED')}
          >
            {saving === 'RECEIVED'
              ? <><span className="spinner" />Saving…</>
              : 'Save as Received'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isSaving}
            onClick={() => handleSubmit('APPROVED')}
          >
            {saving === 'APPROVED'
              ? <><span className="spinner" />Saving…</>
              : 'Save & Approve'}
          </button>
          <Link to="/bills" className="btn btn-outline" style={{ marginLeft: 'auto' }}>
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
