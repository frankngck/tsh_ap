'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrder extends Model {
    static associate(models) {
      PurchaseOrder.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
      PurchaseOrder.hasMany(models.PurchaseOrderItem, { foreignKey: 'purchaseOrderId', as: 'items' });
      PurchaseOrder.hasMany(models.DeliveryOrder, { foreignKey: 'purchaseOrderId', as: 'deliveryOrders' });
      PurchaseOrder.hasMany(models.Bill, { foreignKey: 'purchaseOrderId', as: 'bills' });
    }
  }

  PurchaseOrder.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      poNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      supplierId: { type: DataTypes.INTEGER, allowNull: false },
      orderDate: { type: DataTypes.DATEONLY, allowNull: false },
      expectedDeliveryDate: { type: DataTypes.DATEONLY },
      status: {
        type: DataTypes.ENUM('DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CLOSED', 'CANCELLED'),
        defaultValue: 'DRAFT',
      },
      subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      gstAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
      notes: { type: DataTypes.TEXT },
    },
    {
      sequelize,
      modelName: 'PurchaseOrder',
      tableName: 'purchase_orders',
      timestamps: true,
      underscored: false,
    }
  );

  return PurchaseOrder;
};
