'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Supplier extends Model {
    static associate(models) {
      Supplier.hasMany(models.PurchaseOrder, { foreignKey: 'supplierId', as: 'purchaseOrders' });
      Supplier.hasMany(models.DeliveryOrder, { foreignKey: 'supplierId', as: 'deliveryOrders' });
      Supplier.hasMany(models.Bill, { foreignKey: 'supplierId', as: 'bills' });
    }
  }

  Supplier.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      supplierCode: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      companyName: { type: DataTypes.STRING(200), allowNull: false },
      contactPerson: { type: DataTypes.STRING(150) },
      email: { type: DataTypes.STRING(150) },
      phone: { type: DataTypes.STRING(50) },
      address: { type: DataTypes.TEXT },
      category: { type: DataTypes.STRING(100) },
      paymentTerms: { type: DataTypes.INTEGER, defaultValue: 30, comment: 'Days' },
      gstRegistered: { type: DataTypes.BOOLEAN, defaultValue: false },
      gstNumber: { type: DataTypes.STRING(50) },
      bankName: { type: DataTypes.STRING(100) },
      bankAccount: { type: DataTypes.STRING(100) },
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), defaultValue: 'ACTIVE' },
      notes: { type: DataTypes.TEXT },
    },
    {
      sequelize,
      modelName: 'Supplier',
      tableName: 'suppliers',
      timestamps: true,
      underscored: false,
    }
  );

  return Supplier;
};
