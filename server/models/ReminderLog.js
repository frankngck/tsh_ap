'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ReminderLog extends Model {
    static associate(models) {}
  }

  ReminderLog.init(
    {
      id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      type: {
        type: DataTypes.ENUM('AP_PAYMENT', 'PO_FOLLOWUP'),
        allowNull: false,
      },
      sentAt:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      recordCount:  { type: DataTypes.INTEGER, defaultValue: 0 },
      totalAmount:  { type: DataTypes.DECIMAL(12, 2) },
      status:       { type: DataTypes.ENUM('SENT', 'FAILED'), defaultValue: 'SENT' },
      details:      { type: DataTypes.TEXT },
      errorMessage: { type: DataTypes.TEXT },
    },
    {
      sequelize,
      modelName: 'ReminderLog',
      tableName: 'reminder_logs',
      timestamps: true,
      updatedAt:   false,
      underscored: false,
    }
  );

  return ReminderLog;
};
