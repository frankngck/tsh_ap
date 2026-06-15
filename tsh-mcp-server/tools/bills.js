const { QueryTypes } = require('sequelize');
const db = require('../db');

const schema = {
  name: 'get_bills',
  description: 'Query supplier bills with optional filters. Returns bill list with supplier name, PO reference, amounts and match status.',
  input_schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['RECEIVED', 'APPROVED', 'PAID', 'DISPUTED'],
        description: 'Filter by bill status',
      },
      supplierId: {
        type: 'integer',
        description: 'Filter by supplier ID',
      },
      dateFrom: {
        type: 'string',
        description: 'Filter bills on or after this date (YYYY-MM-DD)',
      },
      dateTo: {
        type: 'string',
        description: 'Filter bills on or before this date (YYYY-MM-DD)',
      },
      minAmount: {
        type: 'number',
        description: 'Filter bills with total >= this amount',
      },
    },
    required: [],
  },
};

async function handler(params = {}) {
  const conditions = ['1=1'];
  const replacements = {};

  if (params.status) {
    conditions.push('b.status = :status');
    replacements.status = params.status;
  }
  if (params.supplierId) {
    conditions.push('b.supplierId = :supplierId');
    replacements.supplierId = params.supplierId;
  }
  if (params.dateFrom) {
    conditions.push('b.billDate >= :dateFrom');
    replacements.dateFrom = params.dateFrom;
  }
  if (params.dateTo) {
    conditions.push('b.billDate <= :dateTo');
    replacements.dateTo = params.dateTo;
  }
  if (params.minAmount != null) {
    conditions.push('b.total >= :minAmount');
    replacements.minAmount = params.minAmount;
  }

  const rows = await db.query(
    `SELECT
       b.id, b.billNumber, b.billDate, b.dueDate, b.status,
       b.subtotal, b.gstAmount, b.total, b.amountPaid,
       ROUND(b.total - b.amountPaid, 2) AS amountOutstanding,
       b.matchStatus,
       s.companyName, s.supplierCode,
       po.poNumber
     FROM bills b
     JOIN suppliers s ON b.supplierId = s.id
     LEFT JOIN purchase_orders po ON b.purchaseOrderId = po.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY b.billDate DESC
     LIMIT 200`,
    { replacements, type: QueryTypes.SELECT }
  );

  return { count: rows.length, bills: rows };
}

module.exports = { schema, handler };
