'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Bill extends Model {
    static associate(models) {
      Bill.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
      Bill.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
      Bill.belongsTo(models.DeliveryOrder, { foreignKey: 'deliveryOrderId', as: 'deliveryOrder' });
      Bill.hasMany(models.BillItem, { foreignKey: 'billId', as: 'items' });
      Bill.hasMany(models.Payment, { foreignKey: 'billId', as: 'payments' });
      Bill.hasMany(models.ReminderLog, { foreignKey: 'billId', as: 'reminderLogs' });
    }
  }

  Bill.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      billNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      supplierId: { type: DataTypes.INTEGER, allowNull: false },
      purchaseOrderId: { type: DataTypes.INTEGER },
      deliveryOrderId: { type: DataTypes.INTEGER },
      billDate: { type: DataTypes.DATEONLY, allowNull: false },
      dueDate: { type: DataTypes.DATEONLY, allowNull: false },
      status: {
        type: DataTypes.ENUM('RECEIVED', 'APPROVED', 'PAID', 'DISPUTED'),
        defaultValue: 'RECEIVED',
      },
      subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      gstAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      amountPaid: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      notes: { type: DataTypes.TEXT },
      disputeReason: { type: DataTypes.TEXT },
      approvedBy: { type: DataTypes.INTEGER },
      approvedAt: { type: DataTypes.DATE },
      matchStatus: {
        type: DataTypes.ENUM('MATCHED', 'DISCREPANCY'),
        allowNull: true,
      },
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
