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
      isIn: [[
        'new',
        'prospect',
        'client',
        'reply',
        'forward'
      ]]
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
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },

  clientId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'clients',
      key: 'id'
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },

  originalEmailId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'emails',
      key: 'id'
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  }

}, {

  tableName: 'drafts',

  timestamps: true,

  indexes: [

    {
      fields: ['prospectId']
    },

    {
      fields: ['clientId']
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