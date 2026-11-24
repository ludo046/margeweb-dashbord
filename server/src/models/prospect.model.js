
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Prospect = sequelize.define('Prospect', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },

  location: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  email: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  phone: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  website: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'À contacter',
    validate: {
      isIn: [[
        'À contacter',
        'Contacté',
        'À relancer',
        'En discussion',
        'Client'
      ]]
    }
  },

  notes: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },

  needs: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },

  creationQuote: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },

  monthlySubscription: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },

  firstContact: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },

  nextFollowUp: {
    type: DataTypes.DATEONLY,
    allowNull: true
  }

}, {
  tableName: 'prospects',
  timestamps: true
});

module.exports = Prospect;
