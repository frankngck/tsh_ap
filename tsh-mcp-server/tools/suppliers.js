const { QueryTypes } = require('sequelize');
const db = require('../db');

const schema = {
  name: 'get_suppliers',
  description: 'List suppliers with their outstanding balances. Returns supplier details including category, payment terms and total amount owed.',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by supplier category (e.g. "Goods", "Services")',
      },
    },
    required: [],
  },
};

async function handler(params = {}) {
  const conditions = ["s.status = 'ACTIVE'"];
  const replacements = {};

  if (params.category) {
    conditions.push('s.category = :category');
    replacements.category = params.category;
  }

  const rows = await db.query(
    `SELECT
       s.id, s.supplierCode, s.companyName, s.category,
       s.paymentTerms, s.email, s.gstRegistered, s.status,
       COALESCE(SUM(CASE WHEN b.status IN ('RECEIVED','APPROVED')
                    THEN b.total - b.amountPaid ELSE 0 END), 0) AS outstandingBalance,
       COUNT(DISTINCT CASE WHEN b.status IN ('RECEIVED','APPROVED') THEN b.id END) AS openBillCount
     FROM suppliers s
     LEFT JOIN bills b ON s.id = b.supplierId
     WHERE ${conditions.join(' AND ')}
     GROUP BY s.id, s.supplierCode, s.companyName, s.category,
              s.paymentTerms, s.email, s.gstRegistered, s.status
     ORDER BY outstandingBalance DESC, s.companyName`,
    { replacements, type: QueryTypes.SELECT }
  );

  const totalOutstanding = rows.reduce((sum, r) => sum + Number(r.outstandingBalance), 0);

  return {
    count: rows.length,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    suppliers: rows,
  };
}

module.exports = { schema, handler };
