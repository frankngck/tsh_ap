import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[2]} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
};
const fmt = (n) => n != null
  ? `S$${Number(n).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`
  : '—';

// ─── Section 2: Document card ─────────────────────────────────────
function DocCard({ label, title, sub, color, missing }) {
  return (
    <div style={{
      background: 'white', borderRadius: 8,
      borderLeft: `4px solid ${color}`,
      padding: '18px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6B7280', marginBottom: 6 }}>
        {label}
      </div>
      {missing ? (
        <div style={{ fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' }}>— Not linked</div>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1F2937', marginBottom: 4, lineHeight: 1.4 }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: '#6B7280' }}>{sub}</div>}
        </>
      )}
    </div>
  );
}

// ─── Match status banner ──────────────────────────────────────────
function MatchBanner({ status }) {
  if (!status) return null;
  const matched = status === 'MATCHED';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 20px', borderRadius: 8,
      background: matched ? '#D1FAE5' : '#FEE2E2',
      border:     matched ? '1px solid #A7F3D0' : '1px solid #FECACA',
      marginBottom: 20, fontWeight: 700, fontSize: 15,
      color: matched ? '#065F46' : '#991B1B',
    }}>
      <span style={{ fontSize: 20 }}>{matched ? '✅' : '⚠️'}</span>
      <span>{matched ? 'ALL ITEMS MATCH — safe to approve' : 'DISCREPANCIES FOUND — review before approving'}</span>
    </div>
  );
}

// ─── Table cells ──────────────────────────────────────────────────
function PriceCell({ value, compare, highlight }) {
  if (value == null) return <td style={{ textAlign: 'right', color: '#D1D5DB' }}>—</td>;
  const diff = compare != null ? value - compare : 0;
  const bad  = highlight && Math.abs(diff) > 0.005;
  return (
    <td style={{ textAlign: 'right', background: bad ? '#FEF2F2' : undefined, fontWeight: bad ? 700 : undefined, color: bad ? '#991B1B' : undefined }}>
      {fmt(value)}
      {bad && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>{diff > 0 ? `+${fmt(diff)}` : fmt(diff)}</div>}
    </td>
  );
}

function QtyCell({ value, reference, highlight }) {
  if (value == null) return <td style={{ textAlign: 'right', color: '#D1D5DB' }}>—</td>;
  const diff = reference != null ? value - reference : 0;
  const bad  = highlight && Math.abs(diff) > 0.005;
  return (
    <td style={{ textAlign: 'right', background: bad ? '#FEF2F2' : undefined, fontWeight: bad ? 700 : undefined, color: bad ? '#991B1B' : undefined }}>
      {Number(value).toLocaleString('en-SG')}
      {bad && diff < 0 && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 2 }}>▼ {Math.abs(diff).toLocaleString('en-SG')} short</div>}
    </td>
  );
}

function MatchCell({ match, issue }) {
  if (match == null) {
    return (
      <td style={{ textAlign: 'center' }}>
        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, background: '#D1D5DB', color: '#6B7280', fontSize: 11, fontWeight: 700 }}>
          — PENDING
        </span>
      </td>
    );
  }
  return (
    <td style={{ textAlign: 'center' }}>
      {match ? (
        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, background: '#059669', color: '#fff', fontSize: 11, fontWeight: 700 }}>
          ✓ MATCH
        </span>
      ) : (
        <div>
          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 700 }}>
            ✗ DISCREPANCY
          </span>
          {issue && <div style={{ fontSize: 10, color: '#EF4444', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{issue}</div>}
        </div>
      )}
    </td>
  );
}

// ─── Dispute modal ────────────────────────────────────────────────
function DisputeModal({ onConfirm, onCancel, loading, initialReason = '' }) {
  const [reason, setReason] = useState(initialReason);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3 className="modal-title">Dispute Bill</h3></div>
        <div className="modal-body">
          <p style={{ marginBottom: 12 }}>Describe the discrepancy reason:</p>
          <textarea
            className="form-control"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Unit price on invoice differs from agreed PO price by S$0.50"
            autoFocus
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-danger" onClick={() => onConfirm(reason)} disabled={loading || !reason.trim()}>
            {loading ? <><span className="spinner" />Disputing…</> : 'Raise Dispute'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section 4: AI Analysis Panel ────────────────────────────────
function recColor(rec = '') {
  const r = rec.toUpperCase();
  if (r.includes('APPROVE') || r.includes('MATCH') || r.includes('OK'))
    return { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' };
  if (r.includes('DISPUTE') || r.includes('MISMATCH') || r.includes('REJECT'))
    return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
  return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
}

function AiPanel({ analysis, loading, error, onApply, canAct }) {
  if (!loading && !error && !analysis) return null;

  const overall     = analysis?.overallRecommendation || '';
  const findings    = analysis?.findings || [];
  const totalImpact = analysis?.totalImpact ?? null;
  const applyLabel  = overall.toUpperCase().includes('APPROVE') ? '✓ Apply: Approve Bill' : '✗ Apply: Raise Dispute';
  const applyStyle  = overall.toUpperCase().includes('APPROVE')
    ? { background: '#10B981', color: '#fff' }
    : { background: '#EF4444', color: '#fff' };

  return (
    <div style={{
      background: '#F5F3FF', borderLeft: '4px solid #7C3AED',
      borderRadius: 8, padding: '18px 22px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ color: '#7C3AED', fontSize: 16 }}>✦</span>
        <span style={{ fontWeight: 700, color: '#4C1D95', fontSize: 15 }}>AI Discrepancy Analysis</span>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#7C3AED', padding: '8px 0' }}>
          <span className="spinner" style={{ borderTopColor: '#7C3AED', borderColor: '#DDD6FE' }} />
          <span style={{ fontWeight: 500 }}>AI is analysing discrepancies…</span>
        </div>
      )}

      {error && !loading && (
        <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && findings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {findings.map((f, i) => {
            const c = recColor(f.recommendation);
            return (
              <div key={i} style={{ background: 'white', borderRadius: 6, padding: '12px 14px', border: '1px solid #EDE9FE' }}>
                <div style={{ fontWeight: 700, color: '#1F2937', marginBottom: 6, fontSize: 13 }}>{f.item}</div>
                <div style={{ fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 1.5 }}>{f.issue}</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                  {f.poValue   != null && <span>PO: <strong>{f.poValue}</strong></span>}
                  {f.billValue != null && <span>Invoice: <strong>{f.billValue}</strong></span>}
                  {f.doValue   != null && <span>DO: <strong>{f.doValue}</strong></span>}
                  {f.impact    != null && Number(f.impact) !== 0 && (
                    <span>Impact: <strong style={{ color: '#EF4444' }}>{fmt(f.impact)}</strong></span>
                  )}
                </div>
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                  fontSize: 11, fontWeight: 700,
                  background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                }}>
                  {f.recommendation}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && analysis && findings.length === 0 && (
        <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 14 }}>No specific findings — all items appear to match.</p>
      )}

      {!loading && !error && overall && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginBottom: 14,
          background: recColor(overall).bg, border: `1px solid ${recColor(overall).border}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', marginBottom: 3 }}>
            Overall Recommendation
          </div>
          <div style={{ fontWeight: 700, color: recColor(overall).text, fontSize: 14 }}>{overall}</div>
          {totalImpact != null && Number(totalImpact) !== 0 && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
              Total financial impact: <strong style={{ color: '#EF4444' }}>{fmt(totalImpact)}</strong>
            </div>
          )}
        </div>
      )}

      {!loading && !error && overall && canAct && (
        <button
          type="button"
          onClick={onApply}
          style={{ ...applyStyle, border: 'none', borderRadius: 6, padding: '10px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          {applyLabel}
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function ThreeWayMatch() {
  const [searchParams] = useSearchParams();
  const billIdFromUrl  = searchParams.get('billId');

  // Bill list
  const [billList,    setBillList]    = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError,   setListError]   = useState('');

  // Selected bill detail
  const [selectedId,    setSelectedId]    = useState(null);
  const [bill,          setBill]          = useState(null);
  const [matchData,     setMatchData]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState('');

  // Actions
  const [actioning,     setActioning]     = useState('');
  const [actionError,   setActionError]   = useState('');
  const [success,       setSuccess]       = useState('');
  const [showDispute,   setShowDispute]   = useState(false);
  const [disputePrefill,setDisputePrefill]= useState('');

  // AI
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiError,    setAiError]    = useState('');

  // Load bill list on mount; honour ?billId= URL param for pre-selection
  useEffect(() => {
    api.get('/bills/three-way-match')
      .then((res) => {
        setBillList(res.data);
        if (res.data.length > 0) {
          const fromUrl = billIdFromUrl ? Number(billIdFromUrl) : null;
          const inList  = fromUrl && res.data.find((b) => b.id === fromUrl);
          setSelectedId(inList ? fromUrl : res.data[0].id);
        }
      })
      .catch((err) => setListError(err.response?.data?.message || 'Failed to load bill list.'))
      .finally(() => setListLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load detail + run match whenever selected bill changes
  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetailError('');
    setBill(null);
    setMatchData(null);
    setAiAnalysis(null);
    setAiError('');
    setSuccess('');
    setActionError('');

    Promise.all([
      api.get(`/bills/${selectedId}`),
      api.post(`/bills/${selectedId}/match`),
    ])
      .then(([billRes, matchRes]) => {
        setBill(billRes.data);
        setMatchData(matchRes.data);
      })
      .catch((err) => setDetailError(err.response?.data?.message || 'Failed to load match data.'))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const refreshList = () =>
    api.get('/bills/three-way-match').then((r) => setBillList(r.data)).catch(() => {});

  const handleApprove = async () => {
    setActioning('approve');
    setActionError('');
    try {
      await api.patch(`/bills/${selectedId}/approve`);
      setSuccess('Bill approved successfully.');
      const [r, m] = await Promise.all([
        api.get(`/bills/${selectedId}`),
        api.post(`/bills/${selectedId}/match`),
      ]);
      setBill(r.data);
      setMatchData(m.data);
      await refreshList();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Approval failed.');
    } finally {
      setActioning('');
    }
  };

  const handleDispute = async (reason) => {
    setActioning('dispute');
    setActionError('');
    try {
      await api.patch(`/bills/${selectedId}/dispute`, { reason });
      setShowDispute(false);
      setDisputePrefill('');
      setSuccess('Bill marked as disputed.');
      const r = await api.get(`/bills/${selectedId}`);
      setBill(r.data);
      await refreshList();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Dispute failed.');
    } finally {
      setActioning('');
    }
  };

  const handleAiResolve = async () => {
    setAiAnalysis(null);
    setAiError('');
    setAiLoading(true);
    try {
      const r = await api.post('/ai/match-analyse', { billId: Number(selectedId) });
      setAiAnalysis(r.data.analysis);
    } catch (err) {
      setAiError(err.response?.data?.message || 'AI analysis failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAi = () => {
    const rec = (aiAnalysis?.overallRecommendation || '').toUpperCase();
    if (rec.includes('APPROVE')) {
      handleApprove();
    } else {
      setDisputePrefill(aiAnalysis?.overallRecommendation || '');
      setShowDispute(true);
    }
  };

  const matchStatus   = matchData?.matchStatus;
  const isMatched     = matchStatus === 'MATCHED';
  const isDiscrepancy = matchStatus === 'DISCREPANCY';
  const results       = matchData?.results || [];
  const canApprove    = bill?.status === 'RECEIVED' && isMatched;
  const canDispute    = bill?.status === 'RECEIVED' && isDiscrepancy;

  // Subtotals (monetary totals in price columns)
  const poTotal  = results.reduce((s, r) => s + (r.poQty != null && r.poPrice != null ? r.poQty * r.poPrice : 0), 0);
  const invTotal = results.reduce((s, r) => s + (r.billQty != null && r.billPrice != null ? r.billQty * r.billPrice : 0), 0);
  const doQtyTotal = results.reduce((s, r) => s + (r.doQty != null ? r.doQty : 0), 0);

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">3-Way Match — PO vs Supplier Invoice vs Delivery Order</h1>
      </div>

      {/* Section 1 — Bill selector */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>
          Select Bill for 3-Way Match
        </label>

        {listLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', padding: '8px 0' }}>
            <span className="spinner" />
            <span>Loading bills…</span>
          </div>
        )}

        {listError && <div className="alert alert-error">{listError}</div>}

        {!listLoading && !listError && billList.length === 0 && (
          <div style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.9 }}>
            No bills are currently linked to a Purchase Order.
            <br />
            Bills need both a PO and a Delivery Order linked to appear here.
            <br />
            <Link to="/bills" style={{ color: 'var(--teal)', fontWeight: 600 }}>Go to Bills</Link> and link a bill to a PO and DO first.
          </div>
        )}

        {!listLoading && !listError && billList.length > 0 && (
          <select
            className="form-control"
            style={{ maxWidth: 500 }}
            value={selectedId ?? ''}
            onChange={(e) => {
              setSelectedId(Number(e.target.value));
              setSuccess('');
              setActionError('');
              setAiAnalysis(null);
              setAiError('');
            }}
          >
            {billList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.billNumber} — {b.supplier?.companyName} ({b.matchStatus ?? 'PENDING'})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Detail loading skeleton */}
      {detailLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          {[1,2,3].map((i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 12, width: 80, borderRadius: 4, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 20, width: 160, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: 100, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {detailError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{detailError}</div>}

      {/* Bill detail sections */}
      {bill && matchData && !detailLoading && (
        <>
          {success     && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}
          {actionError && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{actionError}</div>}

          <MatchBanner status={matchStatus} />

          {/* Section 2 — Three header cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            <DocCard
              label="Purchase Order"
              title={bill.purchaseOrderId
                ? `${bill.purchaseOrder?.poNumber || '—'}  |  ${bill.supplier?.companyName || '—'}`
                : null}
              sub={bill.purchaseOrder ? `Status: ${bill.purchaseOrder.status}` : ''}
              color="#0D9488"
              missing={!bill.purchaseOrderId}
            />
            <DocCard
              label="Supplier Invoice"
              title={`${bill.billNumber}  |  Supplier Invoice`}
              sub={`${bill.supplier?.companyName} · ${fmtDate(bill.billDate)}`}
              color="#10B981"
              missing={false}
            />
            <DocCard
              label="Delivery Order"
              title={bill.deliveryOrderId
                ? `${bill.deliveryOrder?.doNumber || '—'}  |  Delivery Order`
                : null}
              sub={bill.deliveryOrder ? `Status: ${bill.deliveryOrder.status}` : ''}
              color="#F59E0B"
              missing={!bill.deliveryOrderId}
            />
          </div>

          {/* Section 3 — Comparison table */}
          <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>ITEM-BY-ITEM COMPARISON</span>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{results.length} item{results.length !== 1 ? 's' : ''} analysed</span>
            </div>

            {results.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No items found to compare.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ textAlign: 'right' }}>PO Qty</th>
                      <th style={{ textAlign: 'right' }}>PO Price</th>
                      <th style={{ textAlign: 'right' }}>Invoice Qty</th>
                      <th style={{ textAlign: 'right' }}>Invoice Price</th>
                      <th style={{ textAlign: 'right' }}>DO Received</th>
                      <th style={{ textAlign: 'center' }}>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, idx) => {
                      const qtyOk   = row.billQty   == null || Math.abs(row.billQty   - row.poQty)   < 0.005;
                      const priceOk = row.billPrice == null || Math.abs(row.billPrice - row.poPrice)  < 0.005;
                      const doOk    = row.doQty     == null || row.doQty >= row.poQty - 0.005;
                      return (
                        <tr key={idx} style={{ background: row.match === false ? '#FFF5F5' : undefined }}>
                          <td style={{ fontWeight: 500, maxWidth: 200 }}>{row.item}</td>
                          <QtyCell   value={row.poQty}     reference={null}       highlight={false} />
                          <PriceCell value={row.poPrice}   compare={null}         highlight={false} />
                          <QtyCell   value={row.billQty}   reference={row.poQty}  highlight={!qtyOk} />
                          <PriceCell value={row.billPrice} compare={row.poPrice}  highlight={!priceOk} />
                          <QtyCell   value={row.doQty}     reference={row.poQty}  highlight={!doOk} />
                          <MatchCell match={row.match} issue={row.issue} />
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F9FAFB', fontWeight: 700, borderTop: '2px solid #E5E7EB' }}>
                      <td style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Totals</td>
                      <td style={{ textAlign: 'right', color: '#6B7280' }}>—</td>
                      <td style={{ textAlign: 'right' }}>{fmt(poTotal)}</td>
                      <td style={{ textAlign: 'right', color: '#6B7280' }}>—</td>
                      <td style={{ textAlign: 'right' }}>{fmt(invTotal)}</td>
                      <td style={{ textAlign: 'right', color: '#6B7280', fontSize: 12 }}>
                        {doQtyTotal > 0 ? doQtyTotal.toLocaleString('en-SG') : '—'}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Section 4 — AI panel (only for DISCREPANCY) */}
          {isDiscrepancy && (
            <AiPanel
              analysis={aiAnalysis}
              loading={aiLoading}
              error={aiError}
              onApply={handleApplyAi}
              canAct={canApprove || canDispute}
            />
          )}

          {/* Section 5 — Action buttons (bottom right) */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
            {bill.status !== 'RECEIVED' && (
              <span style={{ fontSize: 13, color: '#6B7280' }}>
                Bill status: <strong>{bill.status}</strong> — no further action needed
              </span>
            )}

            <button
              style={{
                background: canApprove ? '#059669' : '#D1D5DB',
                color: 'white', border: 'none', borderRadius: 6,
                padding: '10px 24px', fontWeight: 700, fontSize: 14,
                cursor: canApprove && !actioning ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onClick={canApprove ? handleApprove : undefined}
              disabled={!!actioning || !canApprove}
              title={canApprove ? 'Approve this bill' : 'Only available when all items match'}
            >
              {actioning === 'approve'
                ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 14, height: 14 }} />Approving…</>
                : '✓ Approve Match'}
            </button>

            <button
              style={{
                background: canDispute ? '#DC2626' : '#D1D5DB',
                color: 'white', border: 'none', borderRadius: 6,
                padding: '10px 24px', fontWeight: 700, fontSize: 14,
                cursor: canDispute && !actioning ? 'pointer' : 'not-allowed',
              }}
              onClick={canDispute ? () => { setDisputePrefill(''); setShowDispute(true); } : undefined}
              disabled={!!actioning || !canDispute}
              title={canDispute ? 'Dispute this bill' : 'Only available when discrepancies are found'}
            >
              ✗ Dispute
            </button>

            <button
              type="button"
              onClick={handleAiResolve}
              disabled={aiLoading}
              style={{
                background: '#7C3AED', color: 'white', border: 'none',
                borderRadius: 6, padding: '10px 24px',
                fontWeight: 700, fontSize: 14,
                cursor: aiLoading ? 'not-allowed' : 'pointer',
                opacity: aiLoading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {aiLoading
                ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 14, height: 14 }} />Analysing…</>
                : '✦ AI Resolve'}
            </button>
          </div>
        </>
      )}

      {/* Dispute modal */}
      {showDispute && (
        <DisputeModal
          onConfirm={handleDispute}
          onCancel={() => { setShowDispute(false); setDisputePrefill(''); }}
          loading={actioning === 'dispute'}
          initialReason={disputePrefill}
        />
      )}
    </div>
  );
}
