const { QueryTypes } = require('sequelize');
const db = require('../db');

const schema = {
  name: 'get_po_status',
  description: 'Purchase order tracking. Returns PO list with supplier confirmation status, delivery order count and 3-way match status.',
  input_schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CLOSED', 'CANCELLED'],
        description: 'Filter by PO status',
      },
      supplierId: {
        type: 'integer',
        description: 'Filter by supplier ID',
      },
    },
    required: [],
  },
};

async function handler(params = {}) {
  const conditions = ['1=1'];
  const replacements = {};

  if (params.status) {
    conditions.push('po.status = :status');
    replacements.status = params.status;
  }
  if (params.supplierId) {
    conditions.push('po.supplierId = :supplierId');
    replacements.supplierId = params.supplierId;
  }

  const rows = await db.query(
    `SELECT
       po.id, po.poNumber, po.orderDate, po.expectedDeliveryDate,
       po.status, po.subtotal, po.gstAmount, po.total, po.notes,
       s.companyName, s.supplierCode,
       (SELECT COUNT(*) FROM delivery_orders d WHERE d.purchaseOrderId = po.id) AS deliveryCount,
       (SELECT b.matchStatus FROM bills b WHERE b.purchaseOrderId = po.id
        ORDER BY b.id DESC LIMIT 1) AS matchStatus,
       (SELECT b.status FROM bills b WHERE b.purchaseOrderId = po.id
        ORDER BY b.id DESC LIMIT 1) AS billStatus
     FROM purchase_orders po
     JOIN suppliers s ON po.supplierId = s.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY po.orderDate DESC
     LIMIT 200`,
    { replacements, type: QueryTypes.SELECT }
  );

  return { count: rows.length, purchaseOrders: rows };
}

module.exports = { schema, handler };
