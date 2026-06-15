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
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      billId: { type: DataTypes.INTEGER, allowNull: false },
      paymentDate: { type: DataTypes.DATEONLY, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      paymentMethod: {
        type: DataTypes.ENUM('BANK_TRANSFER', 'CHEQUE', 'CASH', 'GIRO', 'OTHER'),
        defaultValue: 'BANK_TRANSFER',
      },
      reference: { type: DataTypes.STRING(200) },
      notes: { type: DataTypes.TEXT },
      recordedBy: { type: DataTypes.INTEGER },
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
