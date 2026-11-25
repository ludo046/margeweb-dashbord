const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  prospectId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true,
    references: {
      model: 'prospects',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },

  legalName: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  contactName: {
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

  address: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  postalCode: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  city: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  country: {
    type: DataTypes.STRING,
    defaultValue: 'France'
  },

  siret: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Actif',
    validate: {
      isIn: [['Actif', 'Inactif', 'Archivé']]
    }
  },

  clientSince: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  },

  notes: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }

}, {
  tableName: 'clients',
  timestamps: true
});

module.exports = Client;