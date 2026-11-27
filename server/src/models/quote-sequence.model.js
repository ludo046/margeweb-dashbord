const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QuoteSequence = sequelize.define(
  'QuoteSequence',
  {

    // Année de numérotation

    year: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      validate: {
        isInt: true,
        min: 2000,
        max: 9999
      }
    },

    // Dernier numéro attribué

    lastNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0,
        max: Number.MAX_SAFE_INTEGER
      }
    }

  },

  {
    tableName: 'quote_sequences',
    timestamps: true
  }
);

module.exports = QuoteSequence;
