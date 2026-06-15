import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import SupplierScorecard from './SupplierScorecard';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};

const CATEGORY_LABELS = {
  RAW_MATERIALS: 'Raw Materials',
  COMPONENTS:    'Components',
  SERVICES:      'Services',
  PACKAGING:     'Packaging',
  OTHER:         'Other',
};

function DetailRow({ label, children }) {
  return (
    <div className="detail-row">
      <div className="detail-label">{label}</div>
      <div className="detail-value">
        {children ?? <span style={{ color: 'var(--gray-300)' }}>—</span>}
      </div>
    </div>
  );
}

function Sk({ w = '100%', h = 14, mb = 0 }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: 4, marginBottom: mb }} />
  );
}

export default function SupplierDetail() {
  const { id }      = useParams();
  const { hasRole } = useAuth();

  const canEdit      = hasRole('admin', 'clerk');
  const canScorecard = hasRole('admin', 'manager');

  // Manager defaults to scorecard tab; admin/clerk default to profile
  const defaultTab = !hasRole('admin') && hasRole('manager') ? 'scorecard' : 'profile';
  const [tab, setTab] = useState(defaultTab);

  const [supplier, setSupplier] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/suppliers/${id}`)
      .then((r) => { setSupplier(r.data); })
      .catch(() => setError('Supplier not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div><Sk w={240} h={28} mb={8} /><Sk w={140} h={18} /></div>
        </div>
        <div className="card">
          <div className="card-body">
            {[1,2,3,4,5].map((i) => (
              <div key={i} style={{ marginBottom: 18 }}>
                <Sk w="35%" h={11} mb={6} /><Sk w="60%" h={15} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="loading">
        {error || 'Supplier not found.'}&nbsp;
        <Link to="/suppliers">← Back to Suppliers</Link>
      </div>
    );
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{supplier.companyName}</h1>
          <div className="page-subtitle">
            {CATEGORY_LABELS[supplier.category] || supplier.category}
            {supplier.paymentTerms ? ` · Net ${supplier.paymentTerms} days` : ''}
          </div>
        </div>
        {canEdit && (
          <Link to={`/suppliers/${id}/edit`} className="btn btn-primary">Edit Supplier</Link>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="filter-tabs" style={{ marginBottom: 20 }}>
        <button
          className={`filter-tab${tab === 'profile' ? ' filter-tab--active' : ''}`}
          onClick={() => setTab('profile')}
        >
          Profile
        </button>
        {canScorecard && (
          <button
            className={`filter-tab${tab === 'scorecard' ? ' filter-tab--active' : ''}`}
            onClick={() => setTab('scorecard')}
          >
            Payment Performance
          </button>
        )}
      </div>

      {/* ── Profile Tab ── */}
      {tab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Contact Information</span></div>
            <div className="card-body">
              <div className="detail-grid">
                <DetailRow label="Company">{supplier.companyName}</DetailRow>
                <DetailRow label="Contact Person">{supplier.contactPerson}</DetailRow>
                <DetailRow label="Email">
                  {supplier.email
                    ? <a href={`mailto:${supplier.email}`} style={{ color: 'var(--teal)' }}>{supplier.email}</a>
                    : null}
                </DetailRow>
                <DetailRow label="Phone">{supplier.phone}</DetailRow>
                <DetailRow label="Address">
                  {supplier.address
                    ? <span style={{ whiteSpace: 'pre-wrap' }}>{supplier.address}{supplier.postalCode ? ` S(${supplier.postalCode})` : ''}</span>
                    : null}
                </DetailRow>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Commercial Details</span></div>
            <div className="card-body">
              <div className="detail-grid">
                <DetailRow label="Category">
                  {CATEGORY_LABELS[supplier.category] || supplier.category}
                </DetailRow>
                <DetailRow label="Payment Terms">
                  {supplier.paymentTerms != null ? `${supplier.paymentTerms} days` : null}
                </DetailRow>
                <DetailRow label="Bank Account">{supplier.bankAccount}</DetailRow>
                <DetailRow label="Record Created">{fmtDate(supplier.createdAt)}</DetailRow>
                <DetailRow label="Last Updated">{fmtDate(supplier.updatedAt)}</DetailRow>
              </div>
              {canEdit && (
                <div style={{ marginTop: 20 }}>
                  <Link to={`/suppliers/${id}/edit`} className="btn btn-outline">
                    Edit Details
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Performance Tab ── */}
      {tab === 'scorecard' && canScorecard && (
        <SupplierScorecard supplierId={id} />
      )}
    </div>
  );
}
