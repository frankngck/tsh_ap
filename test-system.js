/**
 * test-system.js — B11 final system verification
 * Usage: node test-system.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const BASE = 'http://localhost:5001/api';
const MCP  = 'http://localhost:3001';

let TOKEN = '';
let pass = 0;
let fail = 0;
const failures = [];

function ok(label)   { pass++; console.log(`  ✓ ${label}`); }
function err(label, detail) { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); }

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  TSH-AP Final System Test');
  console.log('══════════════════════════════════════════════════\n');

  // ── Auth ──────────────────────────────────────────────────────
  console.log('─── Auth ────────────────────────────────────────');
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const j = await res.json();
    if (j.token) { TOKEN = j.token; ok('Login returns JWT'); }
    else err('Login returns JWT', JSON.stringify(j));
  } catch (e) { err('Login returns JWT', e.message); }

  if (!TOKEN) { console.log('\n✗ Cannot proceed without token.'); process.exit(1); }

  // ── Suppliers ─────────────────────────────────────────────────
  console.log('\n─── Suppliers ───────────────────────────────────');
  {
    const { status, json } = await api('GET', '/suppliers');
    if (status === 200 && json.length >= 6) ok(`Supplier list: ${json.length} suppliers`);
    else err('Supplier list', `status ${status}, count ${json.length}`);
  }

  // ── Purchase Orders ───────────────────────────────────────────
  console.log('\n─── Purchase Orders ─────────────────────────────');
  let poList = [];
  {
    const { status, json } = await api('GET', '/purchase-orders');
    poList = json;
    if (status === 200 && json.length >= 5) ok(`PO list: ${json.length} POs`);
    else err('PO list', `status ${status}, count ${json.length}`);

    const statuses = json.map(p => p.status);
    if (statuses.includes('RECEIVED') && statuses.includes('SENT') && statuses.includes('DRAFT'))
      ok('PO statuses include RECEIVED, SENT, DRAFT');
    else err('PO statuses', statuses.join(', '));
  }

  // PO detail
  const po1 = poList.find(p => p.poNumber === 'PO-2026-001');
  if (po1) {
    const { status, json } = await api('GET', `/purchase-orders/${po1.id}`);
    if (status === 200 && json.items?.length >= 3 && json.deliveryOrders?.length >= 1)
      ok(`PO-2026-001 detail: ${json.items.length} items, ${json.deliveryOrders.length} DO(s)`);
    else err('PO-2026-001 detail', `items:${json.items?.length} DOs:${json.deliveryOrders?.length}`);
  } else err('PO-2026-001 not found in list');

  // Create PO (test #2)
  let newPoId = null;
  {
    const body = {
      supplierId: poList[0]?.supplier?.id || 11,
      orderDate: '2026-06-14',
      expectedDeliveryDate: '2026-07-01',
      notes: 'Test PO for B11 verification',
      items: [
        { description: 'Test Item A', quantity: 10, unitPrice: 100.00, amount: 1000.00 },
        { description: 'Test Item B', quantity: 5,  unitPrice: 200.00, amount: 1000.00 },
        { description: 'Test Item C', quantity: 20, unitPrice: 50.00,  amount: 1000.00 },
      ],
    };
    const { status, json } = await api('POST', '/purchase-orders', body);
    if (status === 201 && json.poNumber && json.status === 'DRAFT') {
      newPoId = json.id;
      ok(`Create PO: ${json.poNumber} created as DRAFT, total S$${parseFloat(json.total).toFixed(2)}`);
    } else err('Create PO', `status ${status}: ${json.message || JSON.stringify(json).slice(0,80)}`);
  }

  // Send PO (test #3) — route is PUT
  if (newPoId) {
    const { status, json } = await api('PUT', `/purchase-orders/${newPoId}/send`);
    if (status === 200 && json.purchaseOrder?.status === 'SENT') ok('Send PO → status SENT');
    else err('Send PO', `status ${status}: ${JSON.stringify(json).slice(0,80)}`);

    // Confirm PO (test #4) — route is PUT
    const { status: cs, json: cj } = await api('PUT', `/purchase-orders/${newPoId}/confirm`);
    if (cs === 200 && cj.purchaseOrder?.status === 'RECEIVED') ok('Confirm PO → status RECEIVED');
    else err('Confirm PO', `status ${cs}: ${JSON.stringify(cj).slice(0,80)}`);
  }

  // olderThan filter (for n8n workflow 2)
  {
    const { status, json } = await api('GET', '/purchase-orders?status=SENT&olderThan=3');
    if (status === 200) ok(`PO olderThan filter: ${json.length} SENT PO(s) older than 3 days`);
    else err('PO olderThan filter', `status ${status}`);
  }

  // ── Delivery Orders ───────────────────────────────────────────
  console.log('\n─── Delivery Orders ─────────────────────────────');
  {
    const { status, json } = await api('GET', '/delivery-orders');
    if (status === 200 && json.length >= 3) ok(`DO list: ${json.length} DOs`);
    else err('DO list', `status ${status}, count ${json.length}`);

    const do1 = json.find(d => d.doNumber === 'DO-2026-001');
    if (do1) ok(`DO-2026-001: status ${do1.status}, linked to PO ${do1.purchaseOrder?.poNumber || do1.purchaseOrderId}`);
    else err('DO-2026-001 not in list');
  }

  // ── Bills ─────────────────────────────────────────────────────
  console.log('\n─── Bills ───────────────────────────────────────');
  let billList = [];
  {
    const { status, json } = await api('GET', '/bills');
    // Bills endpoint returns paginated { data, total, page, limit }
    billList = Array.isArray(json) ? json : (json.data || []);
    const total = json.total || billList.length;
    if (status === 200 && billList.length >= 8) ok(`Bill list: ${billList.length} bills (total ${total})`);
    else err('Bill list', `status ${status}, count ${billList.length}`);
  }

  // BIL-001 has PO + DO links
  {
    const bil = billList.find(b => b.billNumber === 'BIL-001');
    if (bil && bil.purchaseOrderId && bil.deliveryOrderId && bil.matchStatus === 'MATCHED')
      ok(`BIL-001: purchaseOrderId=${bil.purchaseOrderId}, deliveryOrderId=${bil.deliveryOrderId}, matchStatus=MATCHED`);
    else err('BIL-001 PO/DO link', bil ? `poId:${bil.purchaseOrderId} doId:${bil.deliveryOrderId} match:${bil.matchStatus}` : 'not found');
  }

  // BIL-005 discrepancy
  {
    const bil = billList.find(b => b.billNumber === 'BIL-005');
    if (bil && bil.matchStatus === 'DISCREPANCY')
      ok(`BIL-005: matchStatus=DISCREPANCY, status=${bil.status}`);
    else err('BIL-005 DISCREPANCY', bil ? `match:${bil.matchStatus}` : 'not found');
  }

  // ── Payments ──────────────────────────────────────────────────
  console.log('\n─── Payments ─────────────────────────────────────');
  {
    const { status, json } = await api('GET', '/payments');
    if (status === 200 && json.length >= 5) ok(`Payment list: ${json.length} payments`);
    else err('Payment list', `status ${status}, count ${json.length}`);
  }

  // ── Reports ───────────────────────────────────────────────────
  console.log('\n─── Reports ─────────────────────────────────────');
  {
    const { status, json } = await api('GET', '/reports/summary');
    if (status === 200 && json.totalPayables !== undefined) ok(`Report summary: totalPayables S$${parseFloat(json.totalPayables||0).toFixed(2)}, ${json.outstandingBillCount} outstanding bills`);
    else err('Report summary', `status ${status}: ${JSON.stringify(json).slice(0,80)}`);
  }
  {
    const { status, json } = await api('GET', '/reports/outstanding');
    // returns { grandTotal, suppliers: [...] }
    if (status === 200 && json.grandTotal !== undefined) ok(`Outstanding report: grandTotal S$${json.grandTotal}, ${json.suppliers?.length || 0} supplier(s)`);
    else err('Outstanding report', `status ${status}: ${JSON.stringify(json).slice(0,80)}`);
  }
  {
    const { status, json } = await api('GET', '/reports/cashflow');
    if (status === 200) ok(`Cashflow report: ${Array.isArray(json) ? json.length + ' item(s)' : 'ok'}`);
    else err('Cashflow report', `status ${status}`);
  }

  // ── MCP Server ────────────────────────────────────────────────
  console.log('\n─── MCP Server (port 3001) ───────────────────────');
  try {
    const res = await fetch(`${MCP}/tools`);
    const tools = await res.json();
    if (Array.isArray(tools) && tools.length === 6)
      ok(`MCP /tools: ${tools.length} tools — ${tools.map(t => t.name).join(', ')}`);
    else err('MCP /tools', `got ${JSON.stringify(tools).slice(0,60)}`);
  } catch (e) { err('MCP server reachable', e.message); }

  // MCP execute — get_bills
  try {
    const res = await fetch(`${MCP}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'get_bills', parameters: { status: 'APPROVED' } }),
    });
    const j = await res.json();
    const bills = Array.isArray(j.data) ? j.data : (j.data?.bills || []);
    if (j.success && bills.length >= 0) ok(`MCP get_bills(APPROVED): ${bills.length} bill(s)`);
    else err('MCP get_bills', JSON.stringify(j).slice(0, 80));
  } catch (e) { err('MCP get_bills', e.message); }

  // MCP execute — get_ap_ageing
  try {
    const res = await fetch(`${MCP}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'get_ap_ageing', parameters: {} }),
    });
    const j = await res.json();
    if (j.success && j.data?.summary) ok(`MCP get_ap_ageing: grandTotal S$${parseFloat(j.data.summary.grandTotal||0).toFixed(2)}`);
    else err('MCP get_ap_ageing', JSON.stringify(j).slice(0, 80));
  } catch (e) { err('MCP get_ap_ageing', e.message); }

  // ── AI Endpoints ──────────────────────────────────────────────
  console.log('\n─── AI Endpoints ────────────────────────────────');

  // Dashboard insights
  {
    console.log('  (dashboard insights — calling Claude API, may take ~5s...)');
    const { status, json } = await api('GET', '/ai/dashboard-insights');
    if (status === 200 && json.insights?.length === 3)
      ok(`Dashboard insights: ${json.insights.length} insights returned (types: ${json.insights.map(i=>i.type).join(', ')})`);
    else if (status === 200) ok(`Dashboard insights: returned (${JSON.stringify(json).slice(0,60)})`);
    else err('Dashboard insights', `status ${status}: ${json.message || JSON.stringify(json).slice(0,60)}`);
  }

  // AI query
  {
    console.log('  (AI query — calling Claude API, may take ~10s...)');
    const { status, json } = await api('POST', '/ai/query', { query: 'How many bills are outstanding and what is the total amount?' });
    const answer = json.answer || json.response || json.result || '';
    if (status === 200 && answer) ok('AI query: response received (' + answer.slice(0,60) + '...)');
    else err('AI query', `status ${status}: ${json.message || JSON.stringify(json).slice(0,60)}`);
  }

  // 3-way match AI (BIL-001 has MATCHED PO+DO)
  {
    const bil = billList.find(b => b.billNumber === 'BIL-001');
    if (bil) {
      console.log('  (AI match analyse — calling Claude API, may take ~10s...)');
      const { status, json } = await api('POST', '/ai/match-analyse', { billId: bil.id });
      if (status === 200 && json.analysis) ok('AI match-analyse: analysis returned');
      else err('AI match-analyse', `status ${status}: ${json.message || JSON.stringify(json).slice(0,60)}`);
    } else err('AI match-analyse', 'BIL-001 not found');
  }

  // ── Reminders ─────────────────────────────────────────────────
  console.log('\n─── Reminders ───────────────────────────────────');
  {
    const { status, json } = await api('GET', '/reminders/upcoming');
    if (status === 200 && Array.isArray(json)) ok(`Upcoming reminders: ${json.length} bill(s) due`);
    else err('Upcoming reminders', `status ${status}`);
  }
  {
    const { status, json } = await api('GET', '/reminders/history');
    if (status === 200 && Array.isArray(json) && json.length > 0)
      ok(`Reminder history: ${json.length} day(s) — latest: ${json[0]?.date}, count: ${json[0]?.billCount}`);
    else err('Reminder history', `status ${status}, count ${json?.length}`);
  }
  {
    const { status, json } = await api('POST', '/reminders/send');
    if (status === 200 && json.billCount !== undefined)
      ok(`Manual reminder send: ${json.billCount} bill(s) logged`);
    else if (status === 200 && json.message?.includes('No upcoming'))
      ok('Manual reminder send: no upcoming bills (correct if none due this week)');
    else err('Manual reminder send', `status ${status}: ${json.message || JSON.stringify(json).slice(0,60)}`);
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Results: ${pass} passed  |  ${fail} failed`);
  if (failures.length) {
    console.log('\n  Failed tests:');
    failures.forEach(f => console.log('    ✗ ' + f));
  }
  console.log('══════════════════════════════════════════════════\n');
}

run().catch((e) => { console.error('\n✗ Test runner error:', e.message); process.exit(1); });
