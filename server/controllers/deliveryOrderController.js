const { DeliveryOrder, DeliveryOrderItem, PurchaseOrder, PurchaseOrderItem, Supplier } = require('../models');
const { Op } = require('sequelize');

const generateDoNumber = async () => {
  const year = new Date().getFullYear();
  const latest = await DeliveryOrder.findOne({
    where: { doNumber: { [Op.like]: `DO-${year}-%` } },
    order: [['id', 'DESC']],
  });
  if (!latest) return `DO-${year}-001`;
  const match = latest.doNumber.match(/DO-\d{4}-(\d+)$/);
  const next = match ? parseInt(match[1], 10) + 1 : 1;
  return `DO-${year}-${String(next).padStart(3, '0')}`;
};

exports.getAll = async (req, res) => {
  try {
    const orders = await DeliveryOrder.findAll({
      include: [
        { model: Supplier,      as: 'supplier',      attributes: ['id', 'companyName'] },
        { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['id', 'poNumber'] },
      ],
      order: [['receivedDate', 'DESC']],
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching delivery orders', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const doRecord = await DeliveryOrder.findByPk(req.params.id, {
      include: [
        { model: Supplier, as: 'supplier' },
        {
          model: PurchaseOrder,
          as: 'purchaseOrder',
          include: [{ model: PurchaseOrderItem, as: 'items' }],
        },
        {
          model: DeliveryOrderItem,
          as: 'items',
          include: [{ model: PurchaseOrderItem, as: 'purchaseOrderItem' }],
        },
      ],
    });
    if (!doRecord) return res.status(404).json({ message: 'Delivery order not found' });
    res.json(doRecord);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching delivery order', error: err.message });
  }
};

exports.create = async (req, res) => {
  const t = await DeliveryOrder.sequelize.transaction();
  try {
    const { purchaseOrderId, items = [], ...doData } = req.body;

    doData.doNumber = await generateDoNumber();
    if (!doData.receivedDate) {
      const d = new Date();
      doData.receivedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    let po = null;
    if (purchaseOrderId) {
      po = await PurchaseOrder.findByPk(purchaseOrderId, {
        include: [{ model: PurchaseOrderItem, as: 'items' }],
        transaction: t,
      });
      if (!po) { await t.rollback(); return res.status(404).json({ message: 'Purchase order not found' }); }
      doData.purchaseOrderId = purchaseOrderId;
      if (!doData.supplierId) doData.supplierId = po.supplierId;
    }

    doData.status = doData.status || 'RECEIVED';

    const doRecord = await DeliveryOrder.create(doData, { transaction: t });

    if (items.length > 0) {
      await DeliveryOrderItem.bulkCreate(
        items.map((i) => ({
          deliveryOrderId:  doRecord.id,
          poItemId:         i.poItemId || null,
          description:      i.description,
          quantityReceived: i.quantityReceived || i.quantity || 0,
          remarks:          i.remarks || null,
        })),
        { transaction: t }
      );
    }

    if (po) {
      await PurchaseOrder.update(
        { status: 'PART_RECEIVED' },
        { where: { id: po.id }, transaction: t }
      );
    }

    await t.commit();

    const created = await DeliveryOrder.findByPk(doRecord.id, {
      include: [
        { model: Supplier,          as: 'supplier',      attributes: ['id', 'companyName'] },
        { model: PurchaseOrder,     as: 'purchaseOrder', attributes: ['id', 'poNumber', 'status'] },
        { model: DeliveryOrderItem, as: 'items' },
      ],
    });
    res.status(201).json(created);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: 'Error creating delivery order', error: err.message });
  }
};
