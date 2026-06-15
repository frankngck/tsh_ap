'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      Payment.belongsTo(models.Bill, { foreignKey: 'billId', as: 'bill' });
    }
  }

  Payment.init(
    {
      id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      billId:          { type: DataTypes.INTEGER, allowNull: false },
      paymentDate:     { type: DataTypes.DATEONLY, allowNull: false },
      amount:          { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      method: {
        type: DataTypes.ENUM('BANK_TRANSFER', 'CHEQUE', 'GIRO', 'TELEGRAPHIC_TRANSFER'),
        defaultValue: 'BANK_TRANSFER',
      },
      referenceNumber: { type: DataTypes.STRING(50) },
      notes:           { type: DataTypes.TEXT },
    },
    {
      sequelize,
      modelName: 'Payment',
      tableName: 'payments',
      timestamps: true,
      underscored: false,
    }
  );

  return Payment;
};
