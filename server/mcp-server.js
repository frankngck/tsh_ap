require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const PORT = process.env.MCP_PORT || 3001;

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME     || 'tsh_apv3',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  dateStrings: true,
};

let pool;
async function getPool() {
  if (!pool) pool = await mysql.createPool(dbConfig);
  return pool;
}

// ── Tool schemas ──────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_bills',
    description: 'List bills with optional filters. Returns bill number, supplier name, total, due date, status, and days until due.',
    parameters: {
      type: 'object',
      properties: {
        status:     { type: 'string', enum: ['RECEIVED', 'APPROVED', 'PAID', 'DISPUTED'], description: 'Filter by bill status' },
        supplierId: { type: 'integer', description: 'Filter by supplier ID' },
        dateFrom:   { type: 'string', description: 'Filter bills with dueDate >= dateFrom (YYYY-MM-DD)' },
        dateTo:     { type: 'string', description: 'Filter bills with dueDate <= dateTo (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'get_suppliers',
    description: 'List suppliers with their outstanding balance (sum of unpaid bill totals minus amountPaid).',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['RAW_MATERIALS', 'COMPONENTS', 'SERVICES', 'PACKAGING', 'OTHER'], description: 'Filter by supplier category' },
      },
    },
  },
  {
    name: 'get_ap_ageing',
    description: 'Accounts-payable ageing report bucketed by overdue period per supplier.',
    parameters: {
      type: 'object',
      properties: {
        asOfDate: { type: 'string', description: 'Reference date for ageing calculation (YYYY-MM-DD). Defaults to today.' },
      },
    },
  },
  {
    name: 'get_supplier_payments',
    description: 'Payment history for one or all suppliers, including average days to pay.',
    parameters: {
      type: 'object',
      properties: {
        supplierId: { type: 'integer', description: 'Filter by supplier ID' },
        dateFrom:   { type: 'string', description: 'Filter payments on or after this date (YYYY-MM-DD)' },
        dateTo:     { type: 'string', description: 'Filter payments on or before this date (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'get_cash_forecast',
    description: 'Bills due within the next N days grouped by supplier — useful for cash-flow planning.',
    parameters: {
      type: 'object',
      required: ['days'],
      properties: {
        days: { type: 'integer', enum: [7, 14, 30], description: 'Forecast horizon in days (7, 14, or 30)' },
      },
    },
  },
  {
    name: 'get_po_status',
    description: 'List purchase orders with optional status and supplier filters.',
    parameters: {
      type: 'object',
      properties: {
        status:     { type: 'string', enum: ['DRAFT', 'SENT', 'CONFIRMED', 'PART_RECEIVED', 'COMPLETED', 'CANCELLED'], description: 'Filter by PO status' },
        supplierId: { type: 'integer', description: 'Filter by supplier ID' },
      },
    },
  },
];

// ── Tool implementations ──────────────────────────────────────────────────────

async function getBills({ status, supplierId, dateFrom, dateTo } = {}) {
  const db = await getPool();
  const conditions = [];
  const params = [];

  if (status)     { conditions.push('b.status = ?');       params.push(status); }
  if (supplierId) { conditions.push('b.supplierId = ?');   params.push(supplierId); }
  if (dateFrom)   { conditions.push('b.dueDate >= ?');     params.push(dateFrom); }
  if (dateTo)     { conditions.push('b.dueDate <= ?');     params.push(dateTo); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT
       b.billNumber,
       s.companyName  AS supplierName,
       b.total,
       b.amountPaid,
       b.dueDate,
       b.status,
       DATEDIFF(b.dueDate, CURDATE()) AS daysUntilDue
     FROM bills b
     JOIN suppliers s ON s.id = b.supplierId
     ${where}
     ORDER BY b.dueDate ASC`,
    params
  );
  return rows;
}

async function getSuppliers({ category } = {}) {
  const db = await getPool();
  const conditions = [];
  const params = [];

  if (category) { conditions.push('s.category = ?'); params.push(category); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT
       s.id,
       s.companyName,
       s.category,
       s.paymentTerms,
       s.email,
       s.phone,
       COALESCE(SUM(CASE WHEN b.status != 'PAID' THEN b.total - b.amountPaid ELSE 0 END), 0) AS outstandingBalance
     FROM suppliers s
     LEFT JOIN bills b ON b.supplierId = s.id
     ${where}
     GROUP BY s.id
     ORDER BY s.companyName ASC`,
    params
  );
  return rows;
}

async function getApAgeing({ asOfDate } = {}) {
  const db = await getPool();
  const ref = asOfDate || new Date().toISOString().slice(0, 10);

  const [rows] = await db.query(
    `SELECT
       s.id          AS supplierId,
       s.companyName AS supplierName,
       SUM(CASE WHEN DATEDIFF(?, b.dueDate) <= 0                           THEN b.total - b.amountPaid ELSE 0 END) AS current_amount,
       SUM(CASE WHEN DATEDIFF(?, b.dueDate) BETWEEN 1  AND 30             THEN b.total - b.amountPaid ELSE 0 END) AS days1_30,
       SUM(CASE WHEN DATEDIFF(?, b.dueDate) BETWEEN 31 AND 60             THEN b.total - b.amountPaid ELSE 0 END) AS days31_60,
       SUM(CASE WHEN DATEDIFF(?, b.dueDate) BETWEEN 61 AND 90             THEN b.total - b.amountPaid ELSE 0 END) AS days61_90,
       SUM(CASE WHEN DATEDIFF(?, b.dueDate) > 90                          THEN b.total - b.amountPaid ELSE 0 END) AS days90plus
     FROM bills b
     JOIN suppliers s ON s.id = b.supplierId
     WHERE b.status != 'PAID'
     GROUP BY s.id
     ORDER BY s.companyName ASC`,
    [ref, ref, ref, ref, ref]
  );

  const totals = rows.reduce(
    (acc, r) => {
      acc.current  += parseFloat(r.current_amount) || 0;
      acc.days1_30 += parseFloat(r.days1_30)       || 0;
      acc.days31_60 += parseFloat(r.days31_60)     || 0;
      acc.days61_90 += parseFloat(r.days61_90)     || 0;
      acc.days90plus += parseFloat(r.days90plus)   || 0;
      return acc;
    },
    { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0 }
  );

  return { asOfDate: ref, bySupplier: rows, totals };
}

async function getSupplierPayments({ supplierId, dateFrom, dateTo } = {}) {
  const db = await getPool();
  const conditions = [];
  const params = [];

  if (supplierId) { conditions.push('s.id = ?');           params.push(supplierId); }
  if (dateFrom)   { conditions.push('p.paymentDate >= ?'); params.push(dateFrom); }
  if (dateTo)     { conditions.push('p.paymentDate <= ?'); params.push(dateTo); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT
       p.id            AS paymentId,
       p.paymentDate,
       p.amount,
       p.method,
       p.referenceNumber,
       b.billNumber,
       b.billDate,
       b.dueDate,
       s.id            AS supplierId,
       s.companyName   AS supplierName,
       DATEDIFF(p.paymentDate, b.dueDate) AS daysPastDue
     FROM payments p
     JOIN bills    b ON b.id = p.billId
     JOIN suppliers s ON s.id = b.supplierId
     ${where}
     ORDER BY p.paymentDate DESC`,
    params
  );

  // Compute avgDaysToPay across the result set
  const avgDaysToPay = rows.length
    ? (rows.reduce((sum, r) => sum + (parseInt(r.daysPastDue) || 0), 0) / rows.length).toFixed(1)
    : null;

  return { avgDaysToPay: parseFloat(avgDaysToPay), payments: rows };
}

async function getCashForecast({ days } = {}) {
  const db = await getPool();
  const horizon = parseInt(days) || 7;

  const [rows] = await db.query(
    `SELECT
       s.id            AS supplierId,
       s.companyName   AS supplierName,
       b.billNumber,
       b.dueDate,
       (b.total - b.amountPaid) AS amountDue,
       DATEDIFF(b.dueDate, CURDATE()) AS daysUntilDue
     FROM bills b
     JOIN suppliers s ON s.id = b.supplierId
     WHERE b.status != 'PAID'
       AND b.dueDate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY b.dueDate ASC`,
    [horizon]
  );

  // Group by supplier
  const grouped = {};
  let totalForecast = 0;
  for (const r of rows) {
    if (!grouped[r.supplierId]) {
      grouped[r.supplierId] = { supplierId: r.supplierId, supplierName: r.supplierName, bills: [], subtotal: 0 };
    }
    grouped[r.supplierId].bills.push(r);
    grouped[r.supplierId].subtotal += parseFloat(r.amountDue) || 0;
    totalForecast += parseFloat(r.amountDue) || 0;
  }

  return { forecastDays: horizon, totalForecast, bySupplier: Object.values(grouped) };
}

async function getPoStatus({ status, supplierId } = {}) {
  const db = await getPool();
  const conditions = [];
  const params = [];

  if (status)     { conditions.push('po.status = ?');     params.push(status); }
  if (supplierId) { conditions.push('po.supplierId = ?'); params.push(supplierId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT
       po.id,
       po.poNumber,
       s.companyName AS supplierName,
       po.poDate,
       po.expectedDate,
       po.status,
       po.total,
       po.notes
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplierId
     ${where}
     ORDER BY po.poDate DESC`,
    params
  );
  return rows;
}

// ── Dispatch map ──────────────────────────────────────────────────────────────

const HANDLERS = {
  get_bills:             getBills,
  get_suppliers:         getSuppliers,
  get_ap_ageing:         getApAgeing,
  get_supplier_payments: getSupplierPayments,
  get_cash_forecast:     getCashForecast,
  get_po_status:         getPoStatus,
};

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/tools', (req, res) => {
  res.json(TOOLS);
});

app.post('/execute', async (req, res) => {
  const { name, parameters = {} } = req.body || {};

  if (!name) {
    return res.status(400).json({ success: false, error: 'Missing required field: name' });
  }

  const handler = HANDLERS[name];
  if (!handler) {
    return res.status(404).json({ success: false, error: `Unknown tool: ${name}` });
  }

  try {
    const data = await handler(parameters);
    res.json({ success: true, data });
  } catch (err) {
    console.error(`[mcp] tool=${name} error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`TSH-AP MCP server running on port ${PORT}`);
  console.log(`Tools:   GET  http://localhost:${PORT}/tools`);
  console.log(`Execute: POST http://localhost:${PORT}/execute`);
});
