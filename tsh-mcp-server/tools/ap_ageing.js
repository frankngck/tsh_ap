const { QueryTypes } = require('sequelize');
const db = require('../db');

const schema = {
  name: 'get_ap_ageing',
  description: 'AP ageing breakdown showing outstanding balances grouped by how overdue they are. Returns per-supplier ageing buckets: current (0-30d overdue), 31-60d, 61-90d, and 90+d.',
  input_schema: {
    type: 'object',
    properties: {
      asOfDate: {
        type: 'string',
        description: 'Calculate ageing as of this date (YYYY-MM-DD). Defaults to today.',
      },
    },
    required: [],
  },
};

async function handler(params = {}) {
  const asOfDate = params.asOfDate || new Date().toISOString().slice(0, 10);

  const rows = await db.query(
    `SELECT
       s.id AS supplierId,
       s.companyName,
       s.supplierCode,
       ROUND(SUM(CASE WHEN DATEDIFF(:asOfDate, b.dueDate) <= 30
                      THEN b.total - b.amountPaid ELSE 0 END), 2) AS current_amount,
       ROUND(SUM(CASE WHEN DATEDIFF(:asOfDate, b.dueDate) BETWEEN 31 AND 60
                      THEN b.total - b.amountPaid ELSE 0 END), 2) AS days_31_60,
       ROUND(SUM(CASE WHEN DATEDIFF(:asOfDate, b.dueDate) BETWEEN 61 AND 90
                      THEN b.total - b.amountPaid ELSE 0 END), 2) AS days_61_90,
       ROUND(SUM(CASE WHEN DATEDIFF(:asOfDate, b.dueDate) > 90
                      THEN b.total - b.amountPaid ELSE 0 END), 2) AS days_over_90,
       ROUND(SUM(b.total - b.amountPaid), 2) AS total_outstanding
     FROM bills b
     JOIN suppliers s ON b.supplierId = s.id
     WHERE b.status IN ('RECEIVED', 'APPROVED')
     GROUP BY s.id, s.companyName, s.supplierCode
     HAVING total_outstanding > 0
     ORDER BY total_outstanding DESC`,
    { replacements: { asOfDate }, type: QueryTypes.SELECT }
  );

  const summary = {
    asOfDate,
    current_amount: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_over_90: 0,
    total_outstanding: 0,
  };

  for (const r of rows) {
    summary.current_amount    += Number(r.current_amount);
    summary.days_31_60        += Number(r.days_31_60);
    summary.days_61_90        += Number(r.days_61_90);
    summary.days_over_90      += Number(r.days_over_90);
    summary.total_outstanding += Number(r.total_outstanding);
  }

  for (const k of ['current_amount','days_31_60','days_61_90','days_over_90','total_outstanding']) {
    summary[k] = Math.round(summary[k] * 100) / 100;
  }

  return { asOfDate, summary, bySupplier: rows };
}

module.exports = { schema, handler };
