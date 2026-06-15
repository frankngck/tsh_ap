'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DeliveryOrder extends Model {
    static associate(models) {
      DeliveryOrder.belongsTo(models.Supplier,      { foreignKey: 'supplierId',      as: 'supplier' });
      DeliveryOrder.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
      DeliveryOrder.hasMany(models.DeliveryOrderItem, { foreignKey: 'deliveryOrderId', as: 'items' });
      DeliveryOrder.hasMany(models.Bill,            { foreignKey: 'deliveryOrderId', as: 'bills' });
    }
  }

  DeliveryOrder.init(
    {
      id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      doNumber:        { type: DataTypes.STRING(20), allowNull: false, unique: true },
      purchaseOrderId: { type: DataTypes.INTEGER },
      supplierId:      { type: DataTypes.INTEGER, allowNull: false },
      receivedDate:    { type: DataTypes.DATEONLY },
      status: {
        type: DataTypes.ENUM('RECEIVED', 'INSPECTED', 'ACCEPTED', 'REJECTED'),
        defaultValue: 'RECEIVED',
      },
      receivedBy:      { type: DataTypes.STRING(100) },
      notes:           { type: DataTypes.TEXT },
    },
    {
      sequelize,
      modelName: 'DeliveryOrder',
      tableName: 'delivery_orders',
      timestamps: true,
      underscored: false,
    }
  );

  return DeliveryOrder;
};
