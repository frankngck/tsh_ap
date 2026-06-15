'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Supplier extends Model {
    static associate(models) {
      Supplier.hasMany(models.PurchaseOrder, { foreignKey: 'supplierId', as: 'purchaseOrders' });
      Supplier.hasMany(models.DeliveryOrder, { foreignKey: 'supplierId', as: 'deliveryOrders' });
      Supplier.hasMany(models.Bill, { foreignKey: 'supplierId', as: 'bills' });
    }
  }

  Supplier.init(
    {
      id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      companyName:   { type: DataTypes.STRING(200), allowNull: false },
      contactPerson: { type: DataTypes.STRING(100) },
      email:         { type: DataTypes.STRING(255) },
      phone:         { type: DataTypes.STRING(20) },
      address:       { type: DataTypes.STRING(500) },
      postalCode:    { type: DataTypes.STRING(10) },
      bankAccount:   { type: DataTypes.STRING(50) },
      category:      {
        type: DataTypes.ENUM('RAW_MATERIALS', 'COMPONENTS', 'SERVICES', 'PACKAGING', 'OTHER'),
        defaultValue: 'OTHER',
      },
      paymentTerms:  { type: DataTypes.INTEGER, defaultValue: 30 },
    },
    {
      sequelize,
      modelName: 'Supplier',
      tableName: 'suppliers',
      timestamps: true,
      underscored: false,
    }
  );

  return Supplier;
};
