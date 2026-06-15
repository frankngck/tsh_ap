const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME     || 'tsh_ap',
  process.env.DB_USER     || 'root',
  process.env.DB_PASSWORD || '',
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
  }
);

module.exports = sequelize;
