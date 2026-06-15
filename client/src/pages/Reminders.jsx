import { useEffect, useState } from 'react';
import api from '../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};

const fmt = (n) =>
  `S$${Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`;

// ─── Skeleton ─────────────────────────────────────────────────────
function Sk({ w = '100%', h = 14, r = 4 }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, display: 'block' }} />;
}

// ─── Urgency badge ────────────────────────────────────────────────
const URGENCY_STYLE = {
  URGENT: { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  SOON:   { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  NORMAL: { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
};

function UrgencyBadge({ urgency }) {
  const s = URGENCY_STYLE[urgency] || URGENCY_STYLE.NORMAL;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 10,
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {urgency}
    </span>
  );
}

// ─── Days left cell ───────────────────────────────────────────────
function DaysLeft({ daysLeft }) {
  if (daysLeft < 0) {
    return <span style={{ color: 'var(--red)', fontWeight: 700 }}>{Math.abs(daysLeft)}d overdue</span>;
  }
  if (daysLeft === 0) {
    return <span style={{ color: 'var(--red)', fontWeight: 700 }}>Due today</span>;
  }
  const color = daysLeft <= 2 ? 'var(--red)' : daysLeft <= 5 ? 'var(--amber)' : 'var(--green)';
  return <span style={{ color, fontWeight: 600 }}>{daysLeft}d left</span>;
}

// ─── Summary card ─────────────────────────────────────────────────
function SummaryCard({ label, value, sub, accent, loading }) {
  const ACCENT = {
    red:   { bg: '#FFF5F5', border: '#FCA5A5', val: '#DC2626' },
    amber: { bg: '#FFFBEB', border: '#FCD34D', val: '#D97706' },
    teal:  { bg: '#F0FDFA', border: '#5EEAD4', val: '#0D9488' },
    navy:  { bg: '#EFF6FF', border: '#93C5FD', val: '#1D4ED8' },
  }[accent] || {};

  return (
    <div style={{
      background:   ACCENT.bg,
      border:       `1px solid ${ACCENT.border}`,
      borderRadius: 10,
      padding:      '18px 20px',
      minWidth:     0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6B7280', marginBottom: 10 }}>
        {label}
      </div>
      {loading ? (
        <>
          <Sk w="60%" h={28} r={4} />
          <div style={{ marginTop: 8 }}><Sk w="48%" h={11} /></div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 26, fontWeight: 800, color: ACCENT.val, marginBottom: 4 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: '#6B7280' }}>{sub}</div>}
        </>
      )}
    </div>
  );
}

// ─── n8n Workflow Diagram ─────────────────────────────────────────
const FLOW_STEPS = [
  { icon: '⏰', label: 'Cron',      sub: 'Daily 8 AM'         },
  { icon: '🗄',  label: 'Query DB', sub: 'Bills due ≤7 days'  },
  { icon: '📋', label: 'Format',    sub: 'Urgency table'       },
  { icon: '📧', label: 'Email',     sub: 'To AP staff'         },
  { icon: '📝', label: 'Log',       sub: 'ReminderLog DB'      },
];

function WorkflowDiagram() {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
          n8n AUTOMATION WORKFLOW
        </span>
        <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 12 }}>
          Runs automatically every day at 8:00 AM
        </span>
      </div>
      <div style={{ padding: '20px 24px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 560 }}>
          {FLOW_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < FLOW_STEPS.length - 1 ? '0 0 auto' : '0 0 auto' }}>
              {/* Step box */}
              <div style={{
                background:   'white',
                border:       '2px solid var(--teal)',
                borderRadius: 10,
                padding:      '10px 16px',
                textAlign:    'center',
                minWidth:     96,
                boxShadow:    '0 1px 4px rgba(0,0,0,0.08)',
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{step.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--navy)' }}>{step.label}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{step.sub}</div>
              </div>
              {/* Arrow */}
              {i < FLOW_STEPS.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', color: 'var(--teal)', fontWeight: 700, fontSize: 18, userSelect: 'none' }}>
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function Reminders() {
  const [upcoming,        setUpcoming]        = useState([]);
  const [history,         setHistory]         = useState([]);
  const [loadUpcoming,    setLoadUpcoming]     = useState(true);
  const [loadHistory,     setLoadHistory]      = useState(true);
  const [sending,         setSending]          = useState(false);
  const [sendResult,      setSendResult]       = useState(null);
  const [error,           setError]            = useState('');

  const loadUpcomingData = () => {
    setLoadUpcoming(true);
    api.get('/reminders/upcoming')
      .then((r) => setUpcoming(r.data || []))
      .catch(() => setError('Failed to load upcoming bills.'))
      .finally(() => setLoadUpcoming(false));
  };

  const loadHistoryData = () => {
    setLoadHistory(true);
    api.get('/reminders/history')
      .then((r) => setHistory(r.data || []))
      .catch(() => {})
      .finally(() => setLoadHistory(false));
  };

  useEffect(() => {
    loadUpcomingData();
    loadHistoryData();
  }, []);

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    setError('');
    try {
      const r = await api.post('/reminders/send');
      setSendResult(r.data);
      loadHistoryData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reminder.');
    } finally {
      setSending(false);
    }
  };

  // ── Derived summary values ──────────────────────────────────────
  const totalDue    = upcoming.reduce((s, b) => s + b.amountDue, 0);

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const mtdCount = history
    .filter((h) => String(h.sentAt).slice(0, 7) === currentMonth)
    .reduce((s, h) => s + Number(h.recordCount), 0);

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Payment Reminders</h1>
          <div className="page-subtitle">Internal AP staff reminders — not sent to suppliers</div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSend}
          disabled={sending || upcoming.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {sending
            ? <><span className="spinner" />Sending…</>
            : '📧 Send Now (Manual)'}
        </button>
      </div>

      {/* ── Send result ── */}
      {sendResult && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {sendResult.message}
          {sendResult.billCount > 0 && ` Covering ${sendResult.billCount} bill${sendResult.billCount !== 1 ? 's' : ''} totalling ${fmt(sendResult.totalAmount)}.`}
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <SummaryCard
          label="Bills Due This Week"
          value={loadUpcoming ? '—' : upcoming.length}
          sub={upcoming.filter((b) => b.urgency === 'URGENT').length + ' urgent'}
          accent="red"
          loading={loadUpcoming}
        />
        <SummaryCard
          label="Reminders Sent (MTD)"
          value={loadHistory ? '—' : mtdCount}
          sub="bills reminded this month"
          accent="teal"
          loading={loadHistory}
        />
        <SummaryCard
          label="Total Due Amount"
          value={loadUpcoming ? '—' : fmt(totalDue)}
          sub="across all upcoming bills"
          accent="amber"
          loading={loadUpcoming}
        />
        <SummaryCard
          label="Auto-Schedule"
          value="Daily 8 AM"
          sub="via n8n workflow"
          accent="navy"
          loading={false}
        />
      </div>

      {/* ── Upcoming bills table ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
            UPCOMING BILLS — INTERNAL STAFF REMINDER
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={loadUpcomingData}
            disabled={loadUpcoming}
          >
            ↺ Refresh
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Bill #</th>
              <th>PO #</th>
              <th style={{ textAlign: 'right' }}>Amount Due</th>
              <th>Due Date</th>
              <th style={{ textAlign: 'center' }}>Days Left</th>
              <th style={{ textAlign: 'center' }}>Urgency</th>
            </tr>
          </thead>
          <tbody>
            {loadUpcoming ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[140, 80, 80, 90, 70, 60, 70].map((w, j) => (
                    <td key={j} style={j === 3 ? { textAlign: 'right' } : j >= 5 ? { textAlign: 'center' } : undefined}>
                      <Sk w={w} />
                    </td>
                  ))}
                </tr>
              ))
            ) : upcoming.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state" style={{ padding: '28px 0' }}>
                    <p>No bills due in the next 7 days — you're all clear!</p>
                  </div>
                </td>
              </tr>
            ) : (
              upcoming.map((b) => (
                <tr key={b.id} style={{ background: b.urgency === 'URGENT' ? '#FFFBFB' : undefined }}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 13 }}>
                      {b.supplier?.companyName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                      {b.supplier?.supplierCode}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 13 }}>
                    {b.billNumber}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--gray-500)', fontFamily: 'monospace' }}>
                    {b.poNumber || <span style={{ color: 'var(--gray-300)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                    {fmt(b.amountDue)}
                  </td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {fmtDate(b.dueDate)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <DaysLeft daysLeft={b.daysLeft} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <UrgencyBadge urgency={b.urgency} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── n8n Workflow Diagram ── */}
      <WorkflowDiagram />

      {/* ── Dispatch history ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>DISPATCH HISTORY</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th style={{ textAlign: 'center' }}>Bills</th>
              <th style={{ textAlign: 'right' }}>Total Amount</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loadHistory ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {[100, 40, 100, 70].map((w, j) => (
                    <td key={j} style={{ textAlign: j === 1 ? 'center' : j === 2 ? 'right' : j === 3 ? 'center' : undefined }}>
                      <Sk w={w} />
                    </td>
                  ))}
                </tr>
              ))
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state" style={{ padding: '20px 0' }}>
                    <p>No reminders sent yet. Click "Send Now" to send the first reminder.</p>
                  </div>
                </td>
              </tr>
            ) : (
              history.map((h, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(h.sentAt)}</td>
                  <td style={{ textAlign: 'center', fontSize: 13 }}>{h.recordCount}</td>
                  <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{fmt(h.totalAmount)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                      fontSize: 11, fontWeight: 700,
                      background: h.status === 'SENT' ? '#D1FAE5' : '#FEE2E2',
                      color:      h.status === 'SENT' ? '#065F46' : '#991B1B',
                    }}>
                      {h.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bottom note ── */}
      <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '8px 0 16px' }}>
        ℹ Reminders are sent to AP staff only — suppliers are not notified through this workflow.
      </div>
    </div>
  );
}
