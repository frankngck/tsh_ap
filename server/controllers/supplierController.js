const { Supplier } = require('../models');
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
