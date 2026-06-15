const { QueryTypes } = require('sequelize');
const db = require('../db');

const schema = {
  name: 'get_supplier_payments',
  description: 'Payment history for a specific supplier. Returns payment records with average days from due date and on-time payment percentage.',
  input_schema: {
    type: 'object',
    properties: {
      supplierId: {
        type: 'integer',
        description: 'Supplier ID to retrieve payments for',
      },
      dateFrom: {
        type: 'string',
        description: 'Filter payments on or after this date (YYYY-MM-DD)',
      },
      dateTo: {
        type: 'string',
        description: 'Filter payments on or before this date (YYYY-MM-DD)',
      },
    },
    required: [],
  },
};

async function handler(params = {}) {
  const conditions = ['1=1'];
  const replacements = {};

  if (params.supplierId) {
    conditions.push('b.supplierId = :supplierId');
    replacements.supplierId = params.supplierId;
  }
  if (params.dateFrom) {
    conditions.push('p.paymentDate >= :dateFrom');
    replacements.dateFrom = params.dateFrom;
  }
  if (params.dateTo) {
    conditions.push('p.paymentDate <= :dateTo');
    replacements.dateTo = params.dateTo;
  }

  const rows = await db.query(
    `SELECT
       p.id, p.paymentDate, p.amount, p.paymentMethod, p.reference,
       b.billNumber, b.dueDate, b.supplierId,
       s.companyName, s.supplierCode,
       DATEDIFF(p.paymentDate, b.dueDate) AS daysFromDue
     FROM payments p
     JOIN bills b ON p.billId = b.id
     JOIN suppliers s ON b.supplierId = s.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.paymentDate DESC
     LIMIT 200`,
    { replacements, type: QueryTypes.SELECT }
  );

  let totalDays = 0;
  let onTimeCount = 0;

  for (const r of rows) {
    totalDays += Number(r.daysFromDue);
    if (Number(r.daysFromDue) <= 0) onTimeCount++;
  }

  const avgDaysFromDue = rows.length > 0
    ? Math.round((totalDays / rows.length) * 10) / 10
    : null;

  const onTimePercentage = rows.length > 0
    ? Math.round((onTimeCount / rows.length) * 1000) / 10
    : null;

  return {
    count: rows.length,
    avgDaysFromDue,
    onTimePercentage,
    payments: rows,
  };
}

module.exports = { schema, handler };
