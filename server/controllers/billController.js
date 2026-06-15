const { Bill, BillItem, Supplier, PurchaseOrder, PurchaseOrderItem, DeliveryOrder, DeliveryOrderItem } = require('../models');
const { Op } = require('sequelize');

const generateBillNumber = async () => {
  const latest = await Bill.findOne({ order: [['id', 'DESC']] });
  if (!latest) return 'BIL-001';
  const match = latest.billNumber.match(/BIL-(\d+)$/);
  const next = match ? parseInt(match[1], 10) + 1 : 1;
  return `BIL-${String(next).padStart(3, '0')}`;
};

exports.getAll = async (req, res) => {
  try {
    const { status, supplierId, page = 1, limit = 50 } = req.query;
    const where = {};

    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const bills = await Bill.findAll({
      where,
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'companyName', 'supplierCode'] },
        { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['id', 'poNumber'] },
      ],
      order: [['billDate', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    const total = await Bill.count({ where });

    res.json({ data: bills, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bills', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id, {
      include: [
        { model: Supplier, as: 'supplier' },
        { model: BillItem, as: 'items' },
        { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['id', 'poNumber'] },
        { model: DeliveryOrder, as: 'deliveryOrder', attributes: ['id', 'doNumber'] },
      ],
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bill', error: err.message });
  }
};

exports.create = async (req, res) => {
  const t = await Bill.sequelize.transaction();
  try {
    const { items = [], ...billData } = req.body;
    const GST_RATE = parseFloat(process.env.GST_RATE || 0.09);

    billData.billNumber = await generateBillNumber();

    let subtotal = 0;
    for (const item of items) {
      item.amount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      subtotal += item.amount;
    }

    billData.subtotal = subtotal.toFixed(2);
    billData.gstAmount = (subtotal * GST_RATE).toFixed(2);
    billData.total = (subtotal + subtotal * GST_RATE).toFixed(2);
    billData.amountPaid = 0;
    billData.status = 'RECEIVED';

    const bill = await Bill.create(billData, { transaction: t });

    if (items.length > 0) {
      const billItems = items.map((item) => ({ ...item, billId: bill.id }));
      await BillItem.bulkCreate(billItems, { transaction: t });
    }

    await t.commit();

    const created = await Bill.findByPk(bill.id, {
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'companyName'] },
        { model: BillItem, as: 'items' },
      ],
    });

    res.status(201).json(created);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: 'Error creating bill', error: err.message });
  }
};

exports.update = async (req, res) => {
  const t = await Bill.sequelize.transaction();
  try {
    const bill = await Bill.findByPk(req.params.id, { transaction: t });
    if (!bill) {
      await t.rollback();
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (['PAID'].includes(bill.status)) {
      await t.rollback();
      return res.status(400).json({ message: 'Cannot edit a PAID bill' });
    }

    const { items, ...billData } = req.body;
    delete billData.billNumber;
    delete billData.amountPaid;
    delete billData.status;

    if (items) {
      const GST_RATE = parseFloat(process.env.GST_RATE || 0.09);
      let subtotal = 0;
      for (const item of items) {
        item.amount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        subtotal += item.amount;
      }
      billData.subtotal = subtotal.toFixed(2);
      billData.gstAmount = (subtotal * GST_RATE).toFixed(2);
      billData.total = (subtotal + subtotal * GST_RATE).toFixed(2);

      await BillItem.destroy({ where: { billId: bill.id }, transaction: t });
      await BillItem.bulkCreate(
        items.map((i) => ({ ...i, billId: bill.id })),
        { transaction: t }
      );
    }

    await bill.update(billData, { transaction: t });
    await t.commit();

    const updated = await Bill.findByPk(bill.id, {
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'companyName'] },
        { model: BillItem, as: 'items' },
      ],
    });
    res.json(updated);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: 'Error updating bill', error: err.message });
  }
};

exports.approve = async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    if (bill.status !== 'RECEIVED') {
      return res.status(400).json({ message: `Cannot approve a bill with status ${bill.status}` });
    }

    await bill.update({
      status: 'APPROVED',
      approvedBy: req.user.id,
      approvedAt: new Date(),
    });

    res.json({ message: 'Bill approved', bill });
  } catch (err) {
    res.status(500).json({ message: 'Error approving bill', error: err.message });
  }
};

exports.dispute = async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    if (!['RECEIVED', 'APPROVED'].includes(bill.status)) {
      return res.status(400).json({ message: `Cannot dispute a bill with status ${bill.status}` });
    }

    await bill.update({
      status: 'DISPUTED',
      disputeReason: req.body.reason || null,
    });

    res.json({ message: 'Bill marked as disputed', bill });
  } catch (err) {
    res.status(500).json({ message: 'Error disputing bill', error: err.message });
  }
};

exports.getThreeWayMatchList = async (req, res) => {
  try {
    const bills = await Bill.findAll({
      where: { purchaseOrderId: { [Op.ne]: null } },
      attributes: [
        'id', 'billNumber', 'supplierId', 'purchaseOrderId', 'deliveryOrderId',
        'billDate', 'dueDate', 'total', 'status', 'matchStatus',
      ],
      include: [
        { model: Supplier,       as: 'supplier',       attributes: ['companyName'] },
        { model: PurchaseOrder,  as: 'purchaseOrder',  attributes: ['poNumber', 'status'] },
        { model: DeliveryOrder,  as: 'deliveryOrder',  attributes: ['doNumber', 'status'] },
        { model: BillItem,       as: 'items' },
      ],
      order: [
        ['matchStatus', 'DESC'],
        ['billDate',    'DESC'],
      ],
    });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching 3-way match list', error: err.message });
  }
};

exports.matchAnalyse = async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id, {
      include: [
        { model: BillItem, as: 'items' },
        {
          model: PurchaseOrder,
          as: 'purchaseOrder',
          include: [{ model: PurchaseOrderItem, as: 'items' }],
        },
        {
          model: DeliveryOrder,
          as: 'deliveryOrder',
          include: [{ model: DeliveryOrderItem, as: 'items', required: false }],
        },
      ],
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    const billItems = bill.items || [];
    const poItems   = bill.purchaseOrder?.items || [];
    const doItems   = bill.deliveryOrder?.items || [];

    const descMatch = (a, b) =>
      (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

    // Find DO item: FK match first, then description fallback for NULL-FK rows
    const findDoItem = (poItem) =>
      doItems.find((d) => d.purchaseOrderItemId === poItem.id) ||
      doItems.find((d) => d.purchaseOrderItemId == null && descMatch(d.description, poItem.description)) ||
      null;

    // Find bill item: always by description (bill_items has no poItemId FK)
    const findBillItem = (poItem) =>
      billItems.find((b) => descMatch(b.description, poItem.description)) || null;

    // PO-item-driven LEFT JOIN — one row per PO line, never drops DO rows
    const results = poItems.map((poItem) => {
      const doItem   = findDoItem(poItem);
      const billItem = findBillItem(poItem);

      const poQty     = parseFloat(poItem.quantity  || 0);
      const poPrice   = parseFloat(poItem.unitPrice  || 0);
      const doQty     = doItem   ? parseFloat(doItem.quantity   || 0) : null;
      const billQty   = billItem ? parseFloat(billItem.quantity  || 0) : null;
      const billPrice = billItem ? parseFloat(billItem.unitPrice || 0) : null;

      const issues = [];
      if (doQty === null)
        issues.push('DO item not found');
      else if (doQty < poQty - 0.005)
        issues.push(`quantity shortage: received ${doQty} of ${poQty}`);
      if (billQty === null)
        issues.push('invoice item not found');
      else if (Math.abs(billQty - poQty) > 0.005)
        issues.push('quantity mismatch');
      if (billPrice !== null && Math.abs(billPrice - poPrice) > 0.005)
        issues.push('price mismatch');

      const pending = doItem === null && billItem === null;
      const matched = !pending && issues.length === 0;

      const impact = billPrice !== null && Math.abs(billPrice - poPrice) > 0.005
        ? ((billPrice - poPrice) * (billQty ?? poQty)).toFixed(2)
        : null;

      return {
        item:      poItem.description,
        poQty,
        poPrice,
        billQty,
        billPrice,
        doQty,
        match:     pending ? null : matched,
        issue:     issues[0] || null,
        impact,
      };
    });

    const hasDiscrepancy = results.some((r) => r.match === false);
    const allMatched     = results.length > 0 && results.every((r) => r.match === true);
    const matchStatus    = hasDiscrepancy ? 'DISCREPANCY' : allMatched ? 'MATCHED' : 'PENDING';

    await bill.update({ matchStatus });

    res.json({
      billId:      bill.id,
      billNumber:  bill.billNumber,
      matchStatus,
      hasPO:       !!bill.purchaseOrder,
      hasDO:       !!bill.deliveryOrder,
      results,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error analysing match', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    if (bill.status === 'PAID') {
      return res.status(400).json({ message: 'Cannot delete a PAID bill' });
    }

    await bill.destroy();
    res.json({ message: 'Bill deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting bill', error: err.message });
  }
};
