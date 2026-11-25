
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Draft = sequelize.define('Draft', {

  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  mode: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'new',
    validate: {
      isIn: [
        ['new', 'prospect', 'reply', 'forward']
      ]
    }
  },

  toEmail: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  subject: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },

  prospectId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'prospects',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },

  originalEmailId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'emails',
      key: 'id'
    },
    onDelete: 'SET NULL'
  }

}, {

  tableName: 'drafts',

  timestamps: true,

  indexes: [
    {
      fields: ['prospectId']
    },
    {
      fields: ['originalEmailId']
    },
    {
      fields: ['updatedAt']
    }
  ]

});

module.exports = Draft;
