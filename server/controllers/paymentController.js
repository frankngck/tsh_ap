const { Bill, Payment, Supplier } = require('../models');
const { Op } = require('sequelize');

exports.create = async (req, res) => {
  const t = await Bill.sequelize.transaction();
  try {
    const { billId, paymentDate, amount, paymentMethod, reference, notes } = req.body;

    const bill = await Bill.findByPk(billId, { transaction: t });
    if (!bill) {
      await t.rollback();
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (bill.status !== 'APPROVED') {
      await t.rollback();
      return res.status(400).json({
        message: `Payments can only be recorded for APPROVED bills. Current status: ${bill.status}`,
      });
    }

    const payAmount = parseFloat(amount);
    if (payAmount <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }

    const outstanding = parseFloat(bill.total) - parseFloat(bill.amountPaid);
    if (payAmount > outstanding + 0.001) {
      await t.rollback();
      return res.status(400).json({
        message: `Payment amount (${payAmount}) exceeds outstanding balance (${outstanding.toFixed(2)})`,
      });
    }

    const payment = await Payment.create(
      {
        billId,
        paymentDate,
        amount: payAmount,
        paymentMethod: paymentMethod || 'BANK_TRANSFER',
        reference,
        notes,
        recordedBy: req.user ? req.user.id : null,
      },
      { transaction: t }
    );

    const newAmountPaid = parseFloat(bill.amountPaid) + payAmount;
    const newStatus =
      newAmountPaid >= parseFloat(bill.total) - 0.001 ? 'PAID' : 'APPROVED';

    await bill.update(
      { amountPaid: newAmountPaid.toFixed(2), status: newStatus },
      { transaction: t }
    );

    await t.commit();

    res.status(201).json({
      payment,
      bill: {
        id: bill.id,
        billNumber: bill.billNumber,
        total: bill.total,
        amountPaid: newAmountPaid.toFixed(2),
        status: newStatus,
      },
    });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: 'Error recording payment', error: err.message });
  }
};

exports.getByBill = async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.billId, {
      include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'companyName'] }],
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    const payments = await Payment.findAll({
      where: { billId: req.params.billId },
      order: [['paymentDate', 'DESC']],
    });

    res.json({ bill, payments });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payments', error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod } = req.query;
    const where = {};

    if (startDate && endDate) {
      where.paymentDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.paymentDate = { [Op.gte]: startDate };
    }

    if (paymentMethod) where.paymentMethod = paymentMethod;

    const payments = await Payment.findAll({
      where,
      include: [
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'billNumber', 'total', 'amountPaid', 'status'],
          include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'companyName'] }],
        },
      ],
      order: [['paymentDate', 'DESC']],
    });

    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payments', error: err.message });
  }
};
