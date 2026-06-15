import { useEffect, useState } from 'react';
import api from '../api/axios';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};

const fmt = (n) =>
  `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

// ─── Individual metric card ────────────────────────────────────────
function MetricCard({ label, children, accent }) {
  return (
    <div style={{
      background:   accent ? accent : 'var(--white)',
      border:       '1px solid var(--gray-200)',
      borderRadius: 10,
      padding:      '18px 20px',
      display:      'flex',
      flexDirection:'column',
      gap:          6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────
function SkCard() {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--gray-200)',
      borderRadius: 10, padding: '18px 20px',
    }}>
      <div className="skeleton" style={{ height: 11, width: 80, borderRadius: 4, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 28, width: 120, borderRadius: 4 }} />
    </div>
  );
}

// ─── On-time progress bar ─────────────────────────────────────────
function OnTimeBar({ rate }) {
  const color = rate >= 80 ? 'var(--green)' : rate >= 50 ? '#B45309' : 'var(--red)';
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.2 }}>
        {rate}%
      </div>
      <div style={{
        height: 6, background: 'var(--gray-200)', borderRadius: 3, marginTop: 8,
      }}>
        <div style={{
          height: '100%', width: `${Math.min(rate, 100)}%`,
          background: color, borderRadius: 3, transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function SupplierScorecard({ supplierId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/suppliers/${supplierId}/scorecard`)
      .then((r) => { setData(r.data); })
      .catch(() => setError('Unable to load scorecard.'))
      .finally(() => setLoading(false));
  }, [supplierId]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {Array.from({ length: 7 }).map((_, i) => <SkCard key={i} />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="alert alert-error" style={{ marginTop: 8 }}>
        {error || 'Unable to load scorecard.'}
      </div>
    );
  }

  const m = data.metrics;

  // Avg days to pay display
  let daysLabel, daysColor;
  if (m.avgDaysToPay === null) {
    daysLabel = 'No payments yet';
    daysColor = 'var(--gray-400)';
  } else if (m.avgDaysToPay < 0) {
    daysLabel = `${Math.abs(m.avgDaysToPay)} days early`;
    daysColor = 'var(--green)';
  } else if (m.avgDaysToPay === 0) {
    daysLabel = 'On Time';
    daysColor = 'var(--teal)';
  } else {
    daysLabel = `${m.avgDaysToPay} days late`;
    daysColor = 'var(--red)';
  }

  const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 };
  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 };

  return (
    <div>
      {/* Row 1 — Activity */}
      <div style={grid3}>
        <MetricCard label="Total Bills Received">
          <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--gray-800)', lineHeight: 1.1 }}>
            {m.totalBills}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>bills on record</div>
        </MetricCard>

        <MetricCard label="Total Paid to Date">
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)', lineHeight: 1.2 }}>
            {fmt(m.totalPaid)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>cumulative payments</div>
        </MetricCard>

        <MetricCard
          label="Outstanding Balance"
          accent={m.outstanding > 0 ? '#FEF2F2' : undefined}
        >
          <div style={{ fontSize: 26, fontWeight: 700, color: m.outstanding > 0 ? 'var(--red)' : 'var(--green)', lineHeight: 1.2 }}>
            {fmt(m.outstanding)}
          </div>
          <div style={{ fontSize: 12, color: m.outstanding > 0 ? '#B91C1C' : 'var(--gray-400)' }}>
            {m.outstanding > 0 ? 'awaiting payment' : 'fully settled'}
          </div>
        </MetricCard>
      </div>

      {/* Row 2 — Payment Behaviour */}
      <div style={grid3}>
        <MetricCard label="Avg Days to Pay">
          {m.avgDaysToPay === null ? (
            <div style={{ fontSize: 18, color: 'var(--gray-400)' }}>—</div>
          ) : (
            <>
              <div style={{ fontSize: 26, fontWeight: 700, color: daysColor, lineHeight: 1.2 }}>
                {m.avgDaysToPay > 0 ? '+' : ''}{m.avgDaysToPay}d
              </div>
              <div style={{ fontSize: 12, color: daysColor, fontWeight: 600 }}>{daysLabel}</div>
            </>
          )}
        </MetricCard>

        <MetricCard label="On-Time Payment Rate">
          {m.onTimeRate === null
            ? <div style={{ fontSize: 18, color: 'var(--gray-400)' }}>No payments yet</div>
            : <OnTimeBar rate={m.onTimeRate} />
          }
        </MetricCard>

        <MetricCard
          label="Disputed Bills"
          accent={m.disputedCount > 0 ? '#FEF2F2' : undefined}
        >
          <div style={{ fontSize: 34, fontWeight: 700, color: m.disputedCount > 0 ? 'var(--red)' : 'var(--gray-800)', lineHeight: 1.1 }}>
            {m.disputedCount}
          </div>
          <div style={{ fontSize: 12, color: m.disputedCount > 0 ? '#B91C1C' : 'var(--gray-400)' }}>
            {m.disputedCount > 0 ? 'bills under dispute' : 'no disputes'}
          </div>
        </MetricCard>
      </div>

      {/* Row 3 — Last Activity */}
      <div style={grid2}>
        <MetricCard label="Last Payment Date">
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-800)', lineHeight: 1.2 }}>
            {m.lastPaymentDate ? fmtDate(m.lastPaymentDate) : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>most recent payment received</div>
        </MetricCard>

        <MetricCard label="Payment Terms">
          <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--gray-800)', lineHeight: 1.1 }}>
            {data.paymentTerms ?? 30}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>days net</div>
        </MetricCard>
      </div>
    </div>
  );
}
