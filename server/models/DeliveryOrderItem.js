'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DeliveryOrderItem extends Model {
    static associate(models) {
      DeliveryOrderItem.belongsTo(models.DeliveryOrder, { foreignKey: 'deliveryOrderId', as: 'deliveryOrder' });
      DeliveryOrderItem.belongsTo(models.PurchaseOrderItem, { foreignKey: 'purchaseOrderItemId', as: 'purchaseOrderItem' });
    }
  }

  DeliveryOrderItem.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      deliveryOrderId: { type: DataTypes.INTEGER, allowNull: false },
      purchaseOrderItemId: { type: DataTypes.INTEGER },
      description: { type: DataTypes.STRING(500) },
      quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    },
    {
      sequelize,
      modelName: 'DeliveryOrderItem',
      tableName: 'delivery_order_items',
      timestamps: true,
      underscored: false,
    }
  );

  return DeliveryOrderItem;
};
