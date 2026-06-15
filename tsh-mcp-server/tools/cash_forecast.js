const { QueryTypes } = require('sequelize');
const db = require('../db');

const schema = {
  name: 'get_cash_forecast',
  description: 'Upcoming payment obligations due within N days. Returns bills grouped by supplier showing amount still owed and due dates.',
  input_schema: {
    type: 'object',
    properties: {
      days: {
        type: 'integer',
        enum: [7, 14, 30],
        description: 'Forecast horizon in days (7, 14, or 30). Defaults to 30.',
      },
    },
    required: [],
  },
};

async function handler(params = {}) {
  const days = params.days || 30;

  const rows = await db.query(
    `SELECT
       b.id, b.billNumber, b.dueDate, b.status,
       b.total, b.amountPaid,
       ROUND(b.total - b.amountPaid, 2) AS amountDue,
       s.id AS supplierId, s.companyName, s.supplierCode
     FROM bills b
     JOIN suppliers s ON b.supplierId = s.id
     WHERE b.status IN ('RECEIVED', 'APPROVED')
       AND b.dueDate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL :days DAY)
     ORDER BY b.dueDate, s.companyName`,
    { replacements: { days }, type: QueryTypes.SELECT }
  );

  const bySupplier = {};
  let grandTotal = 0;

  for (const r of rows) {
    if (!bySupplier[r.supplierId]) {
      bySupplier[r.supplierId] = {
        supplierId: r.supplierId,
        companyName: r.companyName,
        supplierCode: r.supplierCode,
        billCount: 0,
        totalDue: 0,
        bills: [],
      };
    }
    const grp = bySupplier[r.supplierId];
    grp.billCount++;
    grp.totalDue = Math.round((grp.totalDue + Number(r.amountDue)) * 100) / 100;
    grp.bills.push({
      id: r.id,
      billNumber: r.billNumber,
      dueDate: r.dueDate,
      status: r.status,
      amountDue: Number(r.amountDue),
    });
    grandTotal += Number(r.amountDue);
  }

  return {
    days,
    totalBills: rows.length,
    grandTotal: Math.round(grandTotal * 100) / 100,
    bySupplier: Object.values(bySupplier),
  };
}

module.exports = { schema, handler };
