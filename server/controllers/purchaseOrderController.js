const { PurchaseOrder, PurchaseOrderItem, Supplier, DeliveryOrder } = require('../models');
const { Op } = require('sequelize');

const generatePoNumber = async () => {
  const year = new Date().getFullYear();
  const latest = await PurchaseOrder.findOne({
    where: { poNumber: { [Op.like]: `PO-${year}-%` } },
    order: [['id', 'DESC']],
  });
  if (!latest) return `PO-${year}-001`;
  const match = latest.poNumber.match(/PO-\d{4}-(\d+)$/);
  const next = match ? parseInt(match[1], 10) + 1 : 1;
  return `PO-${year}-${String(next).padStart(3, '0')}`;
};

exports.getAll = async (req, res) => {
  try {
    const { status, supplierId, olderThan } = req.query;
    const where = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (olderThan) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(olderThan, 10));
      where.updatedAt = { [Op.lt]: cutoff };
    }

    const orders = await PurchaseOrder.findAll({
      where,
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'companyName', 'supplierCode', 'email', 'contactPerson'] },
        { model: PurchaseOrderItem, as: 'items', attributes: ['id', 'amount'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const result = orders.map((po) => {
      const plain = po.toJSON();
      plain.itemCount = plain.items.length;
      return plain;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching purchase orders', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findByPk(req.params.id, {
      include: [
        { model: Supplier, as: 'supplier' },
        { model: PurchaseOrderItem, as: 'items' },
        { model: DeliveryOrder, as: 'deliveryOrders', attributes: ['id', 'doNumber', 'deliveryDate', 'status'] },
      ],
    });
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    res.json(po);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching purchase order', error: err.message });
  }
};

exports.create = async (req, res) => {
  const t = await PurchaseOrder.sequelize.transaction();
  try {
    const { items = [], ...poData } = req.body;
    const GST_RATE = parseFloat(process.env.GST_RATE || 0.09);

    poData.poNumber = await generatePoNumber();
    poData.status = 'DRAFT';
    if (!poData.orderDate) {
      const d = new Date();
      poData.orderDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    let subtotal = 0;
    for (const item of items) {
      item.amount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      subtotal += item.amount;
    }
    poData.subtotal = subtotal.toFixed(2);
    poData.gstAmount = (subtotal * GST_RATE).toFixed(2);
    poData.total = (subtotal + subtotal * GST_RATE).toFixed(2);

    const po = await PurchaseOrder.create(poData, { transaction: t });

    if (items.length > 0) {
      await PurchaseOrderItem.bulkCreate(
        items.map((item) => ({ ...item, purchaseOrderId: po.id })),
        { transaction: t }
      );
    }

    await t.commit();

    const created = await PurchaseOrder.findByPk(po.id, {
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'companyName'] },
        { model: PurchaseOrderItem, as: 'items' },
      ],
    });
    res.status(201).json(created);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: 'Error creating purchase order', error: err.message });
  }
};

exports.update = async (req, res) => {
  const t = await PurchaseOrder.sequelize.transaction();
  try {
    const po = await PurchaseOrder.findByPk(req.params.id, { transaction: t });
    if (!po) {
      await t.rollback();
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    if (['CANCELLED', 'CLOSED'].includes(po.status)) {
      await t.rollback();
      return res.status(400).json({ message: `Cannot edit a ${po.status} purchase order` });
    }

    const { items, ...poData } = req.body;
    delete poData.poNumber;
    delete poData.status;

    if (items) {
      const GST_RATE = parseFloat(process.env.GST_RATE || 0.09);
      let subtotal = 0;
      for (const item of items) {
        item.amount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        subtotal += item.amount;
      }
      poData.subtotal = subtotal.toFixed(2);
      poData.gstAmount = (subtotal * GST_RATE).toFixed(2);
      poData.total = (subtotal + subtotal * GST_RATE).toFixed(2);

      await PurchaseOrderItem.destroy({ where: { purchaseOrderId: po.id }, transaction: t });
      await PurchaseOrderItem.bulkCreate(
        items.map((i) => ({ ...i, purchaseOrderId: po.id })),
        { transaction: t }
      );
    }

    await po.update(poData, { transaction: t });
    await t.commit();

    const updated = await PurchaseOrder.findByPk(po.id, {
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'companyName'] },
        { model: PurchaseOrderItem, as: 'items' },
      ],
    });
    res.json(updated);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: 'Error updating purchase order', error: err.message });
  }
};

exports.send = async (req, res) => {
  try {
    const po = await PurchaseOrder.findByPk(req.params.id);
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    if (po.status !== 'DRAFT') {
      return res.status(400).json({ message: `Cannot send a PO with status ${po.status}` });
    }
    await po.update({ status: 'SENT' });
    res.json({ message: 'Purchase order sent', purchaseOrder: po });
  } catch (err) {
    res.status(500).json({ message: 'Error sending purchase order', error: err.message });
  }
};

exports.confirm = async (req, res) => {
  try {
    const po = await PurchaseOrder.findByPk(req.params.id);
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    if (po.status !== 'SENT') {
      return res.status(400).json({ message: `Cannot confirm a PO with status ${po.status}` });
    }
    // Model ENUM has no CONFIRMED; RECEIVED represents supplier-acknowledged state
    await po.update({ status: 'RECEIVED' });
    res.json({ message: 'Purchase order confirmed', purchaseOrder: po });
  } catch (err) {
    res.status(500).json({ message: 'Error confirming purchase order', error: err.message });
  }
};

exports.cancel = async (req, res) => {
  try {
    const po = await PurchaseOrder.findByPk(req.params.id);
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    if (['CLOSED', 'CANCELLED'].includes(po.status)) {
      return res.status(400).json({ message: `Cannot cancel a ${po.status} purchase order` });
    }
    await po.update({ status: 'CANCELLED' });
    res.json({ message: 'Purchase order cancelled', purchaseOrder: po });
  } catch (err) {
    res.status(500).json({ message: 'Error cancelling purchase order', error: err.message });
  }
};
