import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';

// ─── Category options ─────────────────────────────────────────────
// value = stored in DB, label = shown in UI
const CATEGORIES = [
  { value: 'Raw Materials',  label: 'Raw Materials'  },
  { value: 'Components',     label: 'Components'     },
  { value: 'Services',       label: 'Services'       },
  { value: 'Packaging',      label: 'Packaging'      },
  { value: 'Logistics',      label: 'Logistics'      },
  { value: 'IT Equipment',   label: 'IT Equipment'   },
  { value: 'Office Supplies',label: 'Office Supplies'},
  { value: 'Other',          label: 'Other'          },
];

const EMPTY_FORM = {
  companyName:   '',
  email:         '',
  address:       '',
  category:      '',
  contactPerson: '',
  phone:         '',
  bankAccount:   '',
  paymentTerms:  30,
  // preserved on edit, auto-generated on add (DB requires it)
  supplierCode:  '',
  bankName:      '',
  gstRegistered: false,
  gstNumber:     '',
  status:        'ACTIVE',
  notes:         '',
};

// ─── Inline field error ───────────────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return <span className="field-error">{msg}</span>;
}

// ─── Auto-generate a unique supplier code for new records ─────────
function genCode() {
  return `SUP-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

// ─── Main component ───────────────────────────────────────────────
export default function SupplierForm() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const isEdit    = !!id;

  const [form,    setForm]    = useState(EMPTY_FORM);
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving,  setSaving]  = useState(false);
  const [apiError,setApiError]= useState('');
  const [saved,   setSaved]   = useState(false);

  // ── Load existing supplier in edit mode ─────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/suppliers/${id}`)
      .then((r) => setForm({ ...EMPTY_FORM, ...r.data }))
      .catch(() => setApiError('Supplier not found.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // ── Field setter ─────────────────────────────────────────────────
  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    // Clear error on change
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  };

  // ── Validation ───────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.companyName.trim())
      e.companyName = 'Company name is required.';
    if (!form.email.trim())
      e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address.';
    if (!form.contactPerson.trim())
      e.contactPerson = 'Contact person is required.';
    if (!form.category)
      e.category = 'Please select a category.';
    if (form.paymentTerms !== '' && (isNaN(form.paymentTerms) || Number(form.paymentTerms) < 0))
      e.paymentTerms = 'Must be a positive number.';
    return e;
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        paymentTerms: Number(form.paymentTerms) || 30,
        // Ensure supplierCode is set for new records
        supplierCode: form.supplierCode || genCode(),
      };

      if (isEdit) {
        await api.put(`/suppliers/${id}`, payload);
      } else {
        await api.post('/suppliers', payload);
      }

      setSaved(true);
      setTimeout(() => navigate('/suppliers'), 1400);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Edit Supplier</h1>
        </div>
        <div className="form-card">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="form-group" style={{ marginBottom: 20 }}>
              <div className="skeleton" style={{ height: 12, width: 120, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 38, borderRadius: 4 }} />
            </div>
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
          <h1 className="page-title">
            {isEdit ? 'Edit Supplier' : 'Add New Supplier'}
          </h1>
          <div className="page-subtitle">
            {isEdit
              ? `Supplier ID: ${id} · ${form.supplierCode}`
              : 'Fill in the details to register a new supplier'}
          </div>
        </div>
        <Link to="/suppliers" className="btn btn-secondary">← Back to Suppliers</Link>
      </div>

      {/* ── Success banner ── */}
      {saved && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          ✓ Supplier {isEdit ? 'updated' : 'created'} successfully. Redirecting…
        </div>
      )}

      {/* ── API error banner ── */}
      {apiError && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>{apiError}</div>
      )}

      <form className="form-card sf-form" onSubmit={handleSubmit} noValidate>
        {/* ── Section label ── */}
        <div className="sf-section-label">Supplier Details</div>

        {/* ── 2-column grid ── */}
        <div className="sf-grid">

          {/* ════ LEFT COLUMN ════ */}
          <div className="sf-col">

            {/* Company Name */}
            <div className="form-group">
              <label className="form-label">
                Company Name <span className="req">*</span>
              </label>
              <input
                className={`form-control${errors.companyName ? ' input-error' : ''}`}
                value={form.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                placeholder="Acme Supplies Pte Ltd"
                autoFocus={!isEdit}
              />
              <FieldError msg={errors.companyName} />
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">
                Email <span className="req">*</span>
              </label>
              <input
                type="email"
                className={`form-control${errors.email ? ' input-error' : ''}`}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="accounts@supplier.com"
              />
              <FieldError msg={errors.email} />
            </div>

            {/* Address */}
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-control"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="10 Jurong East Street 12, #03-01, Singapore 609684"
                rows={3}
              />
            </div>

            {/* Category */}
            <div className="form-group">
              <label className="form-label">
                Category <span className="req">*</span>
              </label>
              <select
                className={`form-control${errors.category ? ' input-error' : ''}`}
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                <option value="">— Select category —</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <FieldError msg={errors.category} />
            </div>
          </div>

          {/* ════ RIGHT COLUMN ════ */}
          <div className="sf-col">

            {/* Contact Person */}
            <div className="form-group">
              <label className="form-label">
                Contact Person <span className="req">*</span>
              </label>
              <input
                className={`form-control${errors.contactPerson ? ' input-error' : ''}`}
                value={form.contactPerson}
                onChange={(e) => set('contactPerson', e.target.value)}
                placeholder="John Tan"
              />
              <FieldError msg={errors.contactPerson} />
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-control"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+65 6234 5678"
              />
            </div>

            {/* Bank Account */}
            <div className="form-group">
              <label className="form-label">Bank Account</label>
              <input
                className="form-control"
                value={form.bankAccount}
                onChange={(e) => set('bankAccount', e.target.value)}
                placeholder="DBS 012-345678-9"
              />
              {form.bankAccount && (
                <div className="form-hint">Bank: {form.bankName || 'not specified'}</div>
              )}
            </div>

            {/* Payment Terms */}
            <div className="form-group">
              <label className="form-label">Payment Terms (days)</label>
              <input
                type="number"
                className={`form-control${errors.paymentTerms ? ' input-error' : ''}`}
                value={form.paymentTerms}
                onChange={(e) => set('paymentTerms', e.target.value)}
                min={0}
                max={365}
                placeholder="30"
                style={{ maxWidth: 140 }}
              />
              <FieldError msg={errors.paymentTerms} />
              {!errors.paymentTerms && (
                <div className="form-hint">
                  Due date = bill date + {form.paymentTerms || 30} days
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Form Actions ── */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || saved}
          >
            {saving
              ? <><span className="spinner" />{isEdit ? 'Updating…' : 'Saving…'}</>
              : isEdit ? 'Update Supplier' : 'Save Supplier'}
          </button>
          <Link to="/suppliers" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
