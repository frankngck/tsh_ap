'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BillItem extends Model {
    static associate(models) {
      BillItem.belongsTo(models.Bill, { foreignKey: 'billId', as: 'bill' });
    }
  }

  BillItem.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      billId: { type: DataTypes.INTEGER, allowNull: false },
      itemCode: { type: DataTypes.STRING(100) },
      description: { type: DataTypes.STRING(500), allowNull: false },
      quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    },
    {
      sequelize,
      modelName: 'BillItem',
      tableName: 'bill_items',
      timestamps: true,
      underscored: false,
    }
  );

  return BillItem;
};
