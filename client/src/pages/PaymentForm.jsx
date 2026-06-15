import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

// ─── Constants ────────────────────────────────────────────────────
const METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE',        label: 'Cheque' },
  { value: 'GIRO',          label: 'GIRO' },
  { value: 'CASH',          label: 'Cash' },
  { value: 'OTHER',         label: 'Other' },
];

// ─── Helpers ──────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const fmt = (n) =>
  `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};

// ─── Inline field error ───────────────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return <span className="field-error">{msg}</span>;
}

// ─── Main component ───────────────────────────────────────────────
export default function PaymentForm() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const preselectedId   = searchParams.get('billId') || '';

  const [bills,    setBills]    = useState([]);
  const [form,     setForm]     = useState({
    billId:        preselectedId,
    paymentDate:   todayStr(),
    amount:        '',
    paymentMethod: 'BANK_TRANSFER',
    reference:     '',
    notes:         '',
  });
  const [errors,    setErrors]    = useState({});
  const [apiError,  setApiError]  = useState('');
  const [loadError, setLoadError] = useState('');
  const [saving,    setSaving]    = useState(false);

  // ── Load approved bills ────────────────────────────────────────
  useEffect(() => {
    api.get('/bills?status=APPROVED&limit=200')
      .then((r) => {
        const data = r.data.data || [];
        setBills(data);
        if (preselectedId) {
          const b = data.find((x) => String(x.id) === String(preselectedId));
          if (b) {
            const outstanding = parseFloat(b.total) - parseFloat(b.amountPaid || 0);
            setForm((f) => ({ ...f, amount: outstanding.toFixed(2) }));
          }
        }
      })
      .catch(() => setLoadError('Failed to load approved bills. Is the server running?'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Field setter ───────────────────────────────────────────────
  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  // ── Bill selection ─────────────────────────────────────────────
  const handleBillChange = (id) => {
    setField('billId', id);
    const b = bills.find((x) => String(x.id) === String(id));
    if (b) {
      const outstanding = parseFloat(b.total) - parseFloat(b.amountPaid || 0);
      setForm((f) => ({ ...f, billId: id, amount: outstanding.toFixed(2) }));
    } else {
      setForm((f) => ({ ...f, billId: id, amount: '' }));
    }
    if (errors.billId) setErrors((e) => ({ ...e, billId: '' }));
  };

  const selectedBill = bills.find((b) => String(b.id) === String(form.billId)) || null;
  const outstanding  = selectedBill
    ? parseFloat(selectedBill.total) - parseFloat(selectedBill.amountPaid || 0)
    : null;

  // ── Validation ─────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.billId)
      e.billId = 'Please select a bill.';
    if (!form.amount || parseFloat(form.amount) <= 0)
      e.amount = 'Enter a valid payment amount.';
    else if (outstanding !== null && parseFloat(form.amount) > outstanding + 0.005)
      e.amount = `Amount exceeds outstanding balance of ${fmt(outstanding)}.`;
    if (!form.paymentDate)
      e.paymentDate = 'Payment date is required.';
    return e;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setApiError('');
    setSaving(true);
    try {
      await api.post('/payments', {
        billId:        Number(form.billId),
        paymentDate:   form.paymentDate,
        amount:        parseFloat(form.amount),
        paymentMethod: form.paymentMethod,
        reference:     form.reference || undefined,
        notes:         form.notes     || undefined,
      });

      navigate('/payments', {
        state: {
          successMsg: `Payment of ${fmt(form.amount)} recorded for ${selectedBill?.billNumber}.`,
        },
      });
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to record payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Record Payment to Supplier</h1>
          <div className="page-subtitle">Post a payment against an approved bill</div>
        </div>
        <Link to="/payments" className="btn btn-secondary">← Back to Payments</Link>
      </div>

      {loadError && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>{loadError}</div>
      )}
      {apiError && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>{apiError}</div>
      )}

      <form className="form-card sf-form" onSubmit={handleSubmit} noValidate>
        <div className="sf-section-label">Payment Details</div>

        {/* ── Bill selector ── */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">
            Select Bill <span className="req">*</span>
          </label>
          <select
            className={`form-control${errors.billId ? ' input-error' : ''}`}
            value={form.billId}
            onChange={(e) => handleBillChange(e.target.value)}
          >
            <option value="">— Select Approved Bill —</option>
            {bills.map((b) => {
              const owed = parseFloat(b.total) - parseFloat(b.amountPaid || 0);
              return (
                <option key={b.id} value={b.id}>
                  {b.billNumber} — {b.supplier?.companyName} ({fmt(owed)})
                </option>
              );
            })}
          </select>
          <FieldError msg={errors.billId} />
          {bills.length === 0 && (
            <div className="form-hint">
              No approved bills found.&nbsp;
              <Link to="/bills" style={{ color: 'var(--teal)' }}>Approve a bill first →</Link>
            </div>
          )}
        </div>

        {/* ── Selected bill summary ── */}
        {selectedBill && (
          <div
            style={{
              background:   'var(--teal-light)',
              border:       '1px solid #99F6E4',
              borderRadius: 'var(--radius-sm)',
              padding:      '14px 18px',
              marginBottom: 24,
              fontSize:     13,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {selectedBill.billNumber} · {selectedBill.supplier?.companyName}
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <span>Bill Total: <strong>{fmt(selectedBill.total)}</strong></span>
              <span>Paid to Date: <strong>{fmt(selectedBill.amountPaid)}</strong></span>
              <span style={{ color: '#0F766E', fontWeight: 700 }}>
                Outstanding: <strong>{fmt(outstanding)}</strong>
              </span>
              {selectedBill.dueDate && (
                <span>Due: <strong>{fmtDate(selectedBill.dueDate)}</strong></span>
              )}
            </div>
          </div>
        )}

        {/* ── 2-column grid ── */}
        <div className="sf-grid" style={{ marginBottom: 24 }}>

          {/* LEFT */}
          <div className="sf-col">

            {/* Payment Date */}
            <div className="form-group">
              <label className="form-label">
                Payment Date <span className="req">*</span>
              </label>
              <input
                type="date"
                className={`form-control${errors.paymentDate ? ' input-error' : ''}`}
                value={form.paymentDate}
                onChange={(e) => setField('paymentDate', e.target.value)}
                style={{ maxWidth: 200 }}
              />
              <FieldError msg={errors.paymentDate} />
            </div>

            {/* Amount */}
            <div className="form-group">
              <label className="form-label">
                Amount (S$) <span className="req">*</span>
                {outstanding !== null && (
                  <span style={{ color: 'var(--gray-400)', fontWeight: 400, marginLeft: 8 }}>
                    max {fmt(outstanding)}
                  </span>
                )}
              </label>
              <input
                type="number"
                className={`form-control${errors.amount ? ' input-error' : ''}`}
                step="0.01"
                min="0.01"
                max={outstanding ?? undefined}
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                placeholder="0.00"
                style={{ maxWidth: 220 }}
              />
              <FieldError msg={errors.amount} />
            </div>

          </div>

          {/* RIGHT */}
          <div className="sf-col">

            {/* Payment Method */}
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select
                className="form-control"
                value={form.paymentMethod}
                onChange={(e) => setField('paymentMethod', e.target.value)}
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Reference */}
            <div className="form-group">
              <label className="form-label">Reference Number</label>
              <input
                className="form-control"
                value={form.reference}
                onChange={(e) => setField('reference', e.target.value)}
                placeholder="TT-AP-2026-001 (optional)"
              />
            </div>

          </div>
        </div>

        {/* Notes */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Notes</label>
          <textarea
            className="form-control"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            rows={3}
            placeholder="Additional notes (optional)"
          />
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !form.billId}
          >
            {saving ? <><span className="spinner" />Processing…</> : 'Make Payment'}
          </button>
          <Link to="/payments" className="btn btn-outline" style={{ marginLeft: 'auto' }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
