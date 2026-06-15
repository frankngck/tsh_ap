'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Bill extends Model {
    static associate(models) {
      Bill.belongsTo(models.Supplier,      { foreignKey: 'supplierId',      as: 'supplier' });
      Bill.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
      Bill.belongsTo(models.DeliveryOrder, { foreignKey: 'deliveryOrderId', as: 'deliveryOrder' });
      Bill.hasMany(models.BillItem,        { foreignKey: 'billId',          as: 'items' });
      Bill.hasMany(models.Payment,         { foreignKey: 'billId',          as: 'payments' });
    }
  }

  Bill.init(
    {
      id:                  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      billNumber:          { type: DataTypes.STRING(20), allowNull: false, unique: true },
      supplierId:          { type: DataTypes.INTEGER, allowNull: false },
      purchaseOrderId:     { type: DataTypes.INTEGER },
      deliveryOrderId:     { type: DataTypes.INTEGER },
      billDate:            { type: DataTypes.DATEONLY, allowNull: false },
      dueDate:             { type: DataTypes.DATEONLY, allowNull: false },
      subtotal:            { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      gstAmount:           { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      total:               { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      amountPaid:          { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      status: {
        type: DataTypes.ENUM('RECEIVED', 'APPROVED', 'PAID', 'DISPUTED'),
        allowNull: false,
        defaultValue: 'RECEIVED',
      },
      matchStatus: {
        type: DataTypes.ENUM('PENDING', 'MATCHED', 'DISCREPANCY'),
        defaultValue: 'PENDING',
      },
      approvalStage: {
        type: DataTypes.ENUM('NONE', 'PENDING_MANAGER', 'APPROVED_MANAGER'),
        allowNull: false,
        defaultValue: 'NONE',
      },
      approvedByClerkId:   { type: DataTypes.INTEGER },
      approvedByManagerId: { type: DataTypes.INTEGER },
      approvedAt:          { type: DataTypes.DATE },
      managerApprovedAt:   { type: DataTypes.DATE },
      notes:               { type: DataTypes.TEXT },
    },
    {
      sequelize,
      modelName: 'Bill',
      tableName: 'bills',
      timestamps: true,
      underscored: false,
    }
  );

  return Bill;
};
