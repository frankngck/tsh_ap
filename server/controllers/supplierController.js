const { Supplier, Bill, Payment } = require('../models');
const { Op } = require('sequelize');

exports.getAll = async (req, res) => {
  try {
    const { category, search } = req.query;
    const where = {};

    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { companyName:   { [Op.like]: `%${search}%` } },
        { contactPerson: { [Op.like]: `%${search}%` } },
        { email:         { [Op.like]: `%${search}%` } },
      ];
    }

    const suppliers = await Supplier.findAll({ where, order: [['companyName', 'ASC']] });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching suppliers', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching supplier', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ message: 'Error creating supplier', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    await supplier.update(req.body);
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: 'Error updating supplier', error: err.message });
  }
};

exports.getScorecard = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const bills = await Bill.findAll({
      where: { supplierId: id },
      include: [{ model: Payment, as: 'payments' }],
    });

    let totalPaid       = 0;
    let outstanding     = 0;
    let paymentDiffs    = [];
    let onTimeCount     = 0;
    let disputedCount   = 0;
    let lastPaymentDate = null;

    for (const bill of bills) {
      if (bill.status !== 'PAID') {
        outstanding += parseFloat(bill.total) - parseFloat(bill.amountPaid || 0);
      }
      if (bill.status === 'DISPUTED') disputedCount++;

      for (const payment of (bill.payments || [])) {
        totalPaid += parseFloat(payment.amount);

        const dueDate  = new Date(bill.dueDate);
        const payDate  = new Date(payment.paymentDate);
        const diffDays = Math.round((payDate - dueDate) / 86400000);
        paymentDiffs.push(diffDays);
        if (payDate <= dueDate) onTimeCount++;

        const ds = payment.paymentDate;
        if (!lastPaymentDate || ds > lastPaymentDate) lastPaymentDate = ds;
      }
    }

    const totalPayments = paymentDiffs.length;
    const avgDaysToPay  = totalPayments > 0
      ? Math.round((paymentDiffs.reduce((s, d) => s + d, 0) / totalPayments) * 10) / 10
      : null;
    const onTimeRate = totalPayments > 0
      ? Math.round((onTimeCount / totalPayments) * 100)
      : null;

    res.json({
      supplierId:   parseInt(id),
      companyName:  supplier.companyName,
      category:     supplier.category,
      paymentTerms: supplier.paymentTerms,
      metrics: {
        totalBills:      bills.length,
        totalPaid:       parseFloat(totalPaid.toFixed(2)),
        outstanding:     parseFloat(outstanding.toFixed(2)),
        avgDaysToPay,
        onTimeRate,
        disputedCount,
        lastPaymentDate,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error computing scorecard', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    await supplier.destroy();
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting supplier', error: err.message });
  }
};
