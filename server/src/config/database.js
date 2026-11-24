
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const storage = path.resolve(
  __dirname,
  '../..',
  process.env.DB_STORAGE || './database/margeweb.sqlite'
);

fs.mkdirSync(path.dirname(storage), { recursive: true });

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage,
  logging: false
});

module.exports = sequelize;
