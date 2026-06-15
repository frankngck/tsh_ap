import { useState, useRef } from 'react';
import api from '../api/axios';

// ─── Purple AI palette ────────────────────────────────────────────
const P = {
  base:   '#7C3AED',
  light:  '#EDE9FE',
  mid:    '#C4B5FD',
  dark:   '#4C1D95',
  row:    '#FAF5FF',
  border: '#DDD6FE',
};

// ─── Suggested queries ─────────────────────────────────────────────
const CHIPS = [
  'Bills due this week',
  'AP ageing by supplier',
  'Payment performance last 3 months',
  'Cash flow forecast 30 days',
  'Disputed bills summary',
];

// ─── Inline markdown (bold + code) ────────────────────────────────
function renderInline(text) {
  const parts = [];
  const re = /\*\*(.*?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) parts.push(<strong key={m.index}>{m[1]}</strong>);
    else parts.push(
      <code key={m.index} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3, fontSize: '0.88em', fontFamily: 'monospace' }}>
        {m[2]}
      </code>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 0 ? text : parts;
}

// ─── Markdown table ────────────────────────────────────────────────
function MdTable({ lines }) {
  const parse = (l) =>
    l.split('|').slice(1, -1).map((c) => c.trim());

  const sepIdx = lines.findIndex((l) => /^\|[\s\-:|]+\|/.test(l));
  const headers = sepIdx > 0 ? parse(lines[0]) : [];
  const bodyStart = sepIdx >= 0 ? sepIdx + 1 : 0;
  const body = lines.slice(bodyStart).map(parse);

  return (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '7px 14px', textAlign: 'left',
                  borderBottom: `2px solid ${P.base}`,
                  background: P.light, color: P.dark, fontWeight: 600,
                }}>
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : P.row }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '6px 14px', borderBottom: `1px solid ${P.border}` }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Markdown renderer ─────────────────────────────────────────────
function MarkdownRenderer({ text }) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table block
    if (/^\|/.test(line)) {
      const block = [];
      while (i < lines.length && /^\|/.test(lines[i])) block.push(lines[i++]);
      out.push(<MdTable key={`tbl-${i}`} lines={block} />);
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i]))
        items.push(lines[i++].replace(/^[-*] /, ''));
      out.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: 20, margin: '6px 0' }}>
          {items.map((it, j) => (
            <li key={j} style={{ marginBottom: 3, lineHeight: 1.6 }}>
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i]))
        items.push(lines[i++].replace(/^\d+\. /, ''));
      out.push(
        <ol key={`ol-${i}`} style={{ paddingLeft: 20, margin: '6px 0' }}>
          {items.map((it, j) => (
            <li key={j} style={{ marginBottom: 3, lineHeight: 1.6 }}>
              {renderInline(it)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Headings
    if (/^### /.test(line)) { out.push(<h4 key={i} style={{ margin: '14px 0 4px', color: P.dark }}>{renderInline(line.slice(4))}</h4>); i++; continue; }
    if (/^## /.test(line))  { out.push(<h3 key={i} style={{ margin: '16px 0 6px', color: P.dark }}>{renderInline(line.slice(3))}</h3>); i++; continue; }
    if (/^# /.test(line))   { out.push(<h2 key={i} style={{ margin: '18px 0 8px', color: P.dark }}>{renderInline(line.slice(2))}</h2>); i++; continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { out.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${P.border}`, margin: '12px 0' }} />); i++; continue; }

    // Empty line
    if (!line.trim()) { out.push(<div key={i} style={{ height: 6 }} />); i++; continue; }

    // Paragraph
    out.push(
      <p key={i} style={{ margin: '3px 0', lineHeight: 1.7 }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <>{out}</>;
}

// ─── Loading state ─────────────────────────────────────────────────
function AnalysingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0', color: P.base }}>
      <span className="spinner" style={{ borderTopColor: P.base, borderColor: P.border }} />
      <span style={{ fontWeight: 500 }}>Analysing your data…</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function AIReportGenerator() {
  const [query,    setQuery]    = useState('');
  const [response, setResponse] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const textareaRef = useRef(null);

  const submit = async (q) => {
    const text = (q || query).trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    setResponse('');
    try {
      const r = await api.post('/ai/query', { query: text });
      setResponse(r.data.response || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Query failed. Is the AI service available?');
    } finally {
      setLoading(false);
    }
  };

  const handleChip = (chip) => {
    setQuery(chip);
    submit(chip);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
  };

  const exportStub = (fmt) =>
    alert(`${fmt} export will be available in a future update.`);

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: P.base }}>✦</span> AI Report Generator
          </h1>
          <div className="page-subtitle">
            Ask natural-language questions about your AP data — powered by Claude
          </div>
        </div>
      </div>

      {/* ── Input card ── */}
      <div className="form-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <textarea
            ref={textareaRef}
            className="form-control"
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask questions about your AP data… (Ctrl+Enter to submit)"
            style={{ resize: 'vertical', flex: 1 }}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => submit()}
            disabled={!query.trim() || loading}
            style={{
              background:   P.base,
              color:        '#fff',
              border:       'none',
              borderRadius: 8,
              padding:      '10px 20px',
              fontWeight:   600,
              fontSize:     14,
              cursor:       !query.trim() || loading ? 'not-allowed' : 'pointer',
              opacity:      !query.trim() || loading ? 0.6 : 1,
              whiteSpace:   'nowrap',
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              alignSelf:    'flex-start',
            }}
          >
            {loading
              ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 14, height: 14 }} />Asking…</>
              : <><span style={{ fontSize: 16 }}>✦</span> Ask AI</>}
          </button>
        </div>

        {/* ── Suggested query chips ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleChip(chip)}
              disabled={loading}
              style={{
                background:   loading ? '#f5f5f5' : P.light,
                color:        loading ? '#aaa' : P.dark,
                border:       `1px solid ${loading ? '#e0e0e0' : P.mid}`,
                borderRadius: 20,
                padding:      '5px 14px',
                fontSize:     13,
                cursor:       loading ? 'not-allowed' : 'pointer',
                fontWeight:   500,
                transition:   'background 0.15s, color 0.15s',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── Response area ── */}
      {(loading || response || error) && (
        <div className="form-card">
          {loading && <AnalysingSpinner />}

          {error && (
            <div className="alert alert-error">{error}</div>
          )}

          {response && !loading && (
            <>
              {/* Response header */}
              <div style={{
                display:       'flex',
                alignItems:    'center',
                gap:           8,
                marginBottom:  16,
                paddingBottom: 12,
                borderBottom:  `1px solid ${P.border}`,
              }}>
                <span style={{ color: P.base, fontSize: 18 }}>✦</span>
                <span style={{ fontWeight: 600, color: P.dark, fontSize: 15 }}>AI Response</span>
              </div>

              {/* Response body */}
              <div style={{
                borderLeft:  `3px solid ${P.base}`,
                paddingLeft: 18,
                color:       'var(--gray-800)',
                fontSize:    14,
              }}>
                <MarkdownRenderer text={response} />
              </div>

              {/* Export actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${P.border}` }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => exportStub('PDF')}
                >
                  ↓ Export PDF
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => exportStub('Excel')}
                >
                  ↓ Export Excel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
