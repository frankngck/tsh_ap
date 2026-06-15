'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {}

    async validatePassword(password) {
      return bcrypt.compare(password, this.password);
    }
  }

  User.init(
    {
      id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      email:    { type: DataTypes.STRING(255), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      name:     { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'User' },
      role:     { type: DataTypes.ENUM('admin', 'clerk', 'manager'), allowNull: false, defaultValue: 'clerk' },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
      underscored: false,
    }
  );

  return User;
};
