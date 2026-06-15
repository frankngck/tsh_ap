'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ReminderLog extends Model {
    static associate(models) {
      ReminderLog.belongsTo(models.Bill, { foreignKey: 'billId', as: 'bill' });
    }
  }

  ReminderLog.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      billId: { type: DataTypes.INTEGER, allowNull: false },
      reminderType: { type: DataTypes.STRING(50) },
      sentAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      recipient: { type: DataTypes.STRING(150) },
      message: { type: DataTypes.TEXT },
      status: { type: DataTypes.ENUM('SENT', 'FAILED'), defaultValue: 'SENT' },
    },
    {
      sequelize,
      modelName: 'ReminderLog',
      tableName: 'reminder_logs',
      timestamps: true,
      underscored: false,
    }
  );

  return ReminderLog;
};
