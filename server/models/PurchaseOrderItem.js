'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderItem extends Model {
    static associate(models) {
      PurchaseOrderItem.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
      PurchaseOrderItem.hasMany(models.DeliveryOrderItem, { foreignKey: 'poItemId', as: 'deliveryItems' });
    }
  }

  PurchaseOrderItem.init(
    {
      id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      purchaseOrderId: { type: DataTypes.INTEGER, allowNull: false },
      description:     { type: DataTypes.STRING(500), allowNull: false },
      quantity:        { type: DataTypes.INTEGER, allowNull: false },
      unitPrice:       { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      amount:          { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    },
    {
      sequelize,
      modelName: 'PurchaseOrderItem',
      tableName: 'purchase_order_items',
      timestamps: true,
      underscored: false,
    }
  );

  return PurchaseOrderItem;
};
