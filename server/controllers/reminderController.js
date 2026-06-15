const { Bill, Supplier, PurchaseOrder, ReminderLog } = require('../models');
const { Op, QueryTypes } = require('sequelize');

// ─── Helpers ──────────────────────────────────────────────────────
function localDateStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dueDateStr, todayStr) {
  return Math.round(
    (Date.parse(dueDateStr) - Date.parse(todayStr)) / 86_400_000
  );
}

function urgency(daysLeft) {
  if (daysLeft <= 2) return 'URGENT';
  if (daysLeft <= 5) return 'SOON';
  return 'NORMAL';
}

async function fetchUpcoming() {
  const today   = localDateStr();
  const weekEnd = addDaysStr(today, 7);

  const bills = await Bill.findAll({
    where: {
      status:  { [Op.in]: ['RECEIVED', 'APPROVED'] },
      dueDate: { [Op.lte]: weekEnd },
    },
    include: [
      { model: Supplier,       as: 'supplier',      attributes: ['id', 'companyName', 'supplierCode'] },
      { model: PurchaseOrder,  as: 'purchaseOrder', attributes: ['id', 'poNumber'] },
    ],
    order: [['dueDate', 'ASC']],
  });

  return bills.map((b) => {
    const dl = daysUntil(String(b.dueDate).slice(0, 10), today);
    return {
      id:           b.id,
      billNumber:   b.billNumber,
      dueDate:      String(b.dueDate).slice(0, 10),
      total:        parseFloat(b.total),
      amountPaid:   parseFloat(b.amountPaid),
      amountDue:    Math.round((parseFloat(b.total) - parseFloat(b.amountPaid)) * 100) / 100,
      status:       b.status,
      daysLeft:     dl,
      urgency:      urgency(dl),
      supplier:     b.supplier,
      poNumber:     b.purchaseOrder?.poNumber || null,
    };
  });
}

// ─── GET /api/reminders/upcoming ─────────────────────────────────
exports.upcoming = async (req, res) => {
  try {
    const bills = await fetchUpcoming();
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching upcoming reminders', error: err.message });
  }
};

// ─── GET /api/reminders/history ──────────────────────────────────
exports.history = async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const rows = await sequelize.query(
      `SELECT
         DATE(r.sentAt)                   AS date,
         COUNT(*)                         AS billCount,
         ROUND(SUM(b.total), 2)           AS totalAmount,
         MAX(r.status)                    AS status
       FROM reminder_logs r
       JOIN bills b ON r.billId = b.id
       GROUP BY DATE(r.sentAt)
       ORDER BY date DESC
       LIMIT 30`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reminder history', error: err.message });
  }
};

// ─── POST /api/reminders/send ────────────────────────────────────
exports.send = async (req, res) => {
  try {
    const bills = await fetchUpcoming();

    if (bills.length === 0) {
      return res.json({
        message:     'No bills due this week — nothing to remind.',
        billCount:   0,
        totalAmount: 0,
        bills:       [],
      });
    }

    const now = new Date();
    const logs = bills.map((b) => ({
      billId:       b.id,
      reminderType: 'MANUAL_TRIGGER',
      sentAt:       now,
      recipient:    'AP Staff (Internal)',
      message:      `Payment reminder: ${b.billNumber} from ${b.supplier?.companyName} due ${b.dueDate} (${b.daysLeft >= 0 ? b.daysLeft + ' days' : Math.abs(b.daysLeft) + ' days overdue'}) — S$${b.amountDue.toFixed(2)}. Urgency: ${b.urgency}.`,
      status:       'SENT',
    }));

    await ReminderLog.bulkCreate(logs);

    const totalAmount = bills.reduce((s, b) => s + b.amountDue, 0);

    res.json({
      message:     `Reminder sent for ${bills.length} bill${bills.length !== 1 ? 's' : ''}.`,
      sentAt:      now,
      billCount:   bills.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      bills:       bills.map((b) => ({
        billNumber: b.billNumber,
        supplier:   b.supplier?.companyName,
        dueDate:    b.dueDate,
        daysLeft:   b.daysLeft,
        urgency:    b.urgency,
        amountDue:  b.amountDue,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send reminder', error: err.message });
  }
};
