const { Bill, Supplier, Payment, PurchaseOrder } = require('../models');
const { Op } = require('sequelize');

const localDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const today = () => localDate();

const daysDiff = (dueDate) => {
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
};

const ageBucket = (daysOverdue) => {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'overdue_1_30';
  if (daysOverdue <= 60) return 'overdue_31_60';
  if (daysOverdue <= 90) return 'overdue_61_90';
  return 'overdue_90plus';
};

exports.outstanding = async (req, res) => {
  try {
    const bills = await Bill.findAll({
      where: { status: { [Op.in]: ['RECEIVED', 'APPROVED', 'DISPUTED'] } },
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'companyName', 'paymentTerms'] },
      ],
      attributes: ['id', 'billNumber', 'billDate', 'dueDate', 'total', 'amountPaid', 'status', 'supplierId'],
    });

    const supplierMap = {};
    for (const bill of bills) {
      const sid         = bill.supplierId;
      const outstanding = parseFloat(bill.total) - parseFloat(bill.amountPaid);
      const daysOverdue = daysDiff(bill.dueDate);
      const bucket      = ageBucket(daysOverdue);

      if (!supplierMap[sid]) {
        supplierMap[sid] = {
          supplierId: sid,
          companyName: bill.supplier?.companyName,
          paymentTerms: bill.supplier?.paymentTerms,
          totalOutstanding: 0, current: 0,
          overdue_1_30: 0, overdue_31_60: 0, overdue_61_90: 0, overdue_90plus: 0,
          bills: [],
        };
      }
      supplierMap[sid].totalOutstanding += outstanding;
      supplierMap[sid][bucket] += outstanding;
      supplierMap[sid].bills.push({
        id: bill.id, billNumber: bill.billNumber, billDate: bill.billDate,
        dueDate: bill.dueDate, total: bill.total, amountPaid: bill.amountPaid,
        outstanding: outstanding.toFixed(2), status: bill.status, daysOverdue, bucket,
      });
    }

    const result = Object.values(supplierMap).map((s) => ({
      ...s,
      totalOutstanding: parseFloat(s.totalOutstanding.toFixed(2)),
      current:          parseFloat(s.current.toFixed(2)),
      overdue_1_30:     parseFloat(s.overdue_1_30.toFixed(2)),
      overdue_31_60:    parseFloat(s.overdue_31_60.toFixed(2)),
      overdue_61_90:    parseFloat(s.overdue_61_90.toFixed(2)),
      overdue_90plus:   parseFloat(s.overdue_90plus.toFixed(2)),
    }));
    result.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    const grandTotal = result.reduce((sum, s) => sum + s.totalOutstanding, 0);
    res.json({ generatedAt: new Date().toISOString(), grandTotal: parseFloat(grandTotal.toFixed(2)), suppliers: result });
  } catch (err) {
    res.status(500).json({ message: 'Error generating outstanding report', error: err.message });
  }
};

exports.cashflow = async (req, res) => {
  try {
    const days         = parseInt(req.query.days) || 7;
    const todayStr     = today();
    const futureDate   = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = localDate(futureDate);

    const overdueStart = new Date();
    overdueStart.setDate(overdueStart.getDate() - 90);
    const overdueStartStr = localDate(overdueStart);

    const bills = await Bill.findAll({
      where: {
        status:  { [Op.in]: ['APPROVED', 'RECEIVED'] },
        dueDate: { [Op.between]: [overdueStartStr, futureDateStr] },
      },
      include: [
        { model: Supplier,      as: 'supplier',      attributes: ['id', 'companyName'] },
        { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['id', 'poNumber'] },
      ],
      attributes: ['id', 'billNumber', 'billDate', 'dueDate', 'status', 'total', 'amountPaid'],
      order: [['dueDate', 'ASC']],
    });

    const result = bills.map((bill) => ({
      id:           bill.id,
      billNumber:   bill.billNumber,
      billDate:     bill.billDate,
      supplier:     bill.supplier?.companyName || null,
      poNumber:     bill.purchaseOrder?.poNumber || null,
      dueDate:      bill.dueDate,
      total:        parseFloat(bill.total),
      amountPaid:   parseFloat(bill.amountPaid),
      outstanding:  parseFloat((parseFloat(bill.total) - parseFloat(bill.amountPaid)).toFixed(2)),
      status:       bill.status,
      daysUntilDue: Math.ceil((new Date(bill.dueDate) - new Date()) / (1000 * 60 * 60 * 24)),
    }));

    const totalDue = result.reduce((sum, b) => sum + b.outstanding, 0);
    res.json({
      generatedAt: new Date().toISOString(), forecastDays: days,
      periodEnd: futureDateStr, totalDue: parseFloat(totalDue.toFixed(2)),
      count: result.length, bills: result,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error generating cashflow forecast', error: err.message });
  }
};

exports.summary = async (req, res) => {
  try {
    const todayStr = today();
    const now = new Date();

    const dayOfWeek  = now.getDay();
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek); weekStart.setHours(0, 0, 0, 0);
    const weekEnd    = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = localDate(weekStart);
    const weekEndStr   = localDate(weekEnd);
    const monthStartStr = localDate(new Date(now.getFullYear(), now.getMonth(), 1));

    const [outstandingBills, dueThisWeek, paidMTD, supplierCount] = await Promise.all([
      Bill.findAll({
        where: { status: { [Op.in]: ['RECEIVED', 'APPROVED', 'DISPUTED'] } },
        attributes: ['total', 'amountPaid'],
      }),
      Bill.findAll({
        where: { status: { [Op.in]: ['RECEIVED', 'APPROVED'] }, dueDate: { [Op.between]: [weekStartStr, weekEndStr] } },
        attributes: ['total', 'amountPaid'],
      }),
      Payment.findAll({ where: { paymentDate: { [Op.gte]: monthStartStr } }, attributes: ['amount'] }),
      Supplier.count(),
    ]);

    const totalPayables    = outstandingBills.reduce((sum, b) => sum + parseFloat(b.total) - parseFloat(b.amountPaid), 0);
    const totalDueThisWeek = dueThisWeek.reduce((sum, b) => sum + parseFloat(b.total) - parseFloat(b.amountPaid), 0);
    const totalPaidMTD     = paidMTD.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    res.json({
      generatedAt:          new Date().toISOString(),
      totalPayables:        parseFloat(totalPayables.toFixed(2)),
      outstandingBillCount: outstandingBills.length,
      dueThisWeek:          parseFloat(totalDueThisWeek.toFixed(2)),
      dueThisWeekCount:     dueThisWeek.length,
      paidMTD:              parseFloat(totalPaidMTD.toFixed(2)),
      supplierCount,
      period: { weekStart: weekStartStr, weekEnd: weekEndStr, monthStart: monthStartStr, today: todayStr },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error generating summary', error: err.message });
  }
};
