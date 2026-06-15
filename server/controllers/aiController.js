const Anthropic  = require('@anthropic-ai/sdk');
const { Op, fn, col, literal, QueryTypes } = require('sequelize');

const MCP_BASE = 'http://localhost:3001';

const MATCH_SYSTEM_PROMPT =
  'You are an AP auditor for TSH Synergy. Compare these three documents line by line. ' +
  'For each item check: 1. PO quantity vs DO quantity received vs Bill quantity ' +
  '2. PO unit price vs Bill unit price. ' +
  'Flag any discrepancies with specific amounts and percentages. ' +
  'Recommend actions: APPROVE if all match, DISPUTE if price mismatch > 2%, DEBIT NOTE if quantity shortage. ' +
  'Return ONLY a JSON object with: ' +
  '{ findings: [{item, issue, poValue, billValue, doValue, impact, recommendation}], ' +
  'overallRecommendation: string, totalImpact: number }';

const QUERY_SYSTEM_PROMPT =
  'You are an AP analyst for TSH Synergy Pte Ltd. ' +
  'Answer questions about accounts payable data using the available tools. ' +
  'Always query the database first, then provide clear analysis with specific numbers. ' +
  'Format tables in markdown. Use Singapore dollars (SGD). Be concise but thorough.';

const INSIGHTS_SYSTEM_PROMPT =
  'You are an AP assistant for TSH Synergy Pte Ltd. Given these AP metrics, generate exactly 3 actionable insights. ' +
  'Each insight should be specific with real numbers from the data. Return ONLY a JSON array, no other text. ' +
  'Each object has: { "type": "warning"|"positive"|"info"|"deadline", "text": string } ' +
  'Types: warning=needs action, positive=good news, info=general, deadline=time-sensitive.';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── MCP helpers ──────────────────────────────────────────────────
async function mcpGet(path) {
  const res = await fetch(`${MCP_BASE}${path}`);
  if (!res.ok) throw new Error(`MCP GET ${path} failed: ${res.status}`);
  return res.json();
}

async function mcpExecute(name, parameters) {
  const res = await fetch(`${MCP_BASE}/execute`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, parameters }),
  });
  if (!res.ok) throw new Error(`MCP execute ${name} failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// ─── Date helpers ──────────────────────────────────────────────────
function localDateStr(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

// ─── POST /api/ai/query ───────────────────────────────────────────
exports.query = async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ message: 'query is required' });
  }

  try {
    const mcpTools = await mcpGet('/tools');
    const tools = mcpTools.map((t) => ({
      name:         t.name,
      description:  t.description,
      input_schema: t.parameters,
    }));

    const messages = [{ role: 'user', content: query.trim() }];

    while (true) {
      const response = await client.messages.create({
        model:      process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 4096,
        system:     QUERY_SYSTEM_PROMPT,
        tools,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text');
        return res.json({ response: textBlock ? textBlock.text : '' });
      }

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find((b) => b.type === 'text');
        return res.json({ response: textBlock ? textBlock.text : 'No response generated.' });
      }

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          try {
            const data = await mcpExecute(block.name, block.input);
            return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(data) };
          } catch (err) {
            return { type: 'tool_result', tool_use_id: block.id, is_error: true, content: err.message };
          }
        })
      );

      messages.push({ role: 'user', content: toolResults });
    }
  } catch (err) {
    console.error('AI query error:', err.message);
    res.status(500).json({ message: 'AI query failed', error: err.message });
  }
};

// ─── GET /api/ai/dashboard-insights ──────────────────────────────
exports.dashboardInsights = async (req, res) => {
  try {
    const { Bill, Payment, sequelize } = require('../models');

    const today    = localDateStr();
    const weekEnd  = addDays(today, 7);
    const monthStart = `${today.slice(0, 8)}01`;

    const [outstanding, overdueCount, dueThisWeek, paidMonth, avgDelay, discrepancies] =
      await Promise.all([
        // Total outstanding balance
        Bill.findOne({
          attributes: [[fn('SUM', literal('total - amountPaid')), 'val']],
          where: { status: { [Op.ne]: 'PAID' } },
          raw: true,
        }),

        // Overdue bills (past due, not paid)
        Bill.count({
          where: {
            status:  { [Op.notIn]: ['PAID'] },
            dueDate: { [Op.lt]: today },
          },
        }),

        // Bills due this week
        Bill.findOne({
          attributes: [
            [fn('COUNT', col('id')),             'count'],
            [fn('SUM', literal('total - amountPaid')), 'amount'],
          ],
          where: {
            status:  { [Op.notIn]: ['PAID'] },
            dueDate: { [Op.between]: [today, weekEnd] },
          },
          raw: true,
        }),

        // Total paid this calendar month
        Payment.findOne({
          attributes: [[fn('SUM', col('amount')), 'val']],
          where: { paymentDate: { [Op.gte]: monthStart } },
          raw: true,
        }),

        // Avg payment delay vs due date (last 90 days)
        sequelize.query(
          `SELECT ROUND(AVG(DATEDIFF(p.paymentDate, b.dueDate)), 1) AS avgDays
           FROM payments p
           JOIN bills b ON p.billId = b.id
           WHERE p.paymentDate >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`,
          { type: QueryTypes.SELECT }
        ),

        // 3-way match discrepancies
        Bill.count({ where: { matchStatus: 'DISCREPANCY' } }),
      ]);

    const metrics = {
      totalOutstanding:    Math.round(parseFloat(outstanding?.val   || 0) * 100) / 100,
      overdueCount,
      dueThisWeekCount:    parseInt(dueThisWeek?.count  || 0, 10),
      dueThisWeekAmount:   Math.round(parseFloat(dueThisWeek?.amount || 0) * 100) / 100,
      paidThisMonth:       Math.round(parseFloat(paidMonth?.val || 0) * 100) / 100,
      avgPaymentDelayDays: parseFloat(avgDelay[0]?.avgDays || 0),
      discrepancyCount:    discrepancies,
      asOfDate:            today,
    };

    const aiResponse = await client.messages.create({
      model:      process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 512,
      system:     INSIGHTS_SYSTEM_PROMPT,
      messages:   [{
        role:    'user',
        content: `AP metrics as of ${today}:\n${JSON.stringify(metrics, null, 2)}\n\nReturn exactly 3 insights as a JSON array.`,
      }],
    });

    const raw     = aiResponse.content.find((b) => b.type === 'text')?.text?.trim() || '[]';
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const insights = JSON.parse(jsonStr);

    res.json({ insights, metrics });
  } catch (err) {
    console.error('Dashboard insights error:', err.message);
    res.status(500).json({ message: 'Failed to generate insights', error: err.message });
  }
};

// ─── POST /api/ai/match-analyse ───────────────────────────────────
exports.matchAnalyse = async (req, res) => {
  const { billId } = req.body;
  if (!billId) return res.status(400).json({ message: 'billId is required' });

  try {
    const {
      Bill, BillItem, PurchaseOrder, PurchaseOrderItem,
      DeliveryOrder, DeliveryOrderItem,
    } = require('../models');

    const bill = await Bill.findByPk(billId, {
      include: [{ model: BillItem, as: 'items' }],
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (!bill.purchaseOrderId)
      return res.status(400).json({ message: 'Bill has no linked PO — cannot run AI match analysis' });

    const [po, doRecord] = await Promise.all([
      PurchaseOrder.findByPk(bill.purchaseOrderId, {
        include: [{ model: PurchaseOrderItem, as: 'items' }],
      }),
      bill.deliveryOrderId
        ? DeliveryOrder.findByPk(bill.deliveryOrderId, {
            include: [{ model: DeliveryOrderItem, as: 'items' }],
          })
        : null,
    ]);

    const toNum = (v) => parseFloat(v || 0);

    const poLines = (po?.items || []).map((i) => ({
      description: i.description,
      quantity:    toNum(i.quantity),
      unitPrice:   toNum(i.unitPrice),
    }));

    const billLines = (bill.items || []).map((i) => ({
      description: i.description,
      quantity:    toNum(i.quantity),
      unitPrice:   toNum(i.unitPrice),
      amount:      toNum(i.amount),
    }));

    const doLines = doRecord
      ? (doRecord.items || []).map((i) => ({
          description:      i.description,
          quantityReceived: toNum(i.quantity),
        }))
      : [];

    const userMsg =
      `Analyse 3-way match for bill ${bill.billNumber}:\n\n` +
      `PURCHASE ORDER (${po?.poNumber || 'N/A'}):\n${JSON.stringify(poLines, null, 2)}\n\n` +
      `SUPPLIER INVOICE:\n${JSON.stringify(billLines, null, 2)}\n\n` +
      `DELIVERY ORDER (${doRecord?.doNumber || 'not linked'}):\n${JSON.stringify(doLines.length ? doLines : 'No delivery order', null, 2)}\n\n` +
      `Bill total: SGD ${bill.total} | PO total: SGD ${po?.total || 'N/A'}\n\n` +
      'Return the analysis JSON object as specified.';

    const aiResponse = await client.messages.create({
      model:      process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     MATCH_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMsg }],
    });

    const raw     = aiResponse.content.find((b) => b.type === 'text')?.text?.trim() || '{}';
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const analysis = JSON.parse(jsonStr);

    res.json({ analysis, billNumber: bill.billNumber });
  } catch (err) {
    console.error('AI match analyse error:', err.message);
    res.status(500).json({ message: 'AI match analysis failed', error: err.message });
  }
};
