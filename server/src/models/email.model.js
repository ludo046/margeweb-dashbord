
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Email = sequelize.define('Email', {

  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  uid: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  uidValidity: {
    type: DataTypes.STRING,
    allowNull: false
  },

  messageId: {
    type: DataTypes.STRING,
    allowNull: true
  },

  folder: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'INBOX'
  },

  fromName: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  fromEmail: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  toEmail: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },

  subject: {
    type: DataTypes.STRING,
    defaultValue: ''
  },

  textContent: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },

  htmlContent: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },

  receivedAt: {
    type: DataTypes.DATE,
    allowNull: false
  },

  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  hasAttachments: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  prospectId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'prospects',
      key: 'id'
    },
    onDelete: 'SET NULL'
  }

}, {
  tableName: 'emails',
  timestamps: true,

  indexes: [
    {
      unique: true,
      fields: ['folder', 'uidValidity', 'uid']
    },
    {
      fields: ['messageId']
    },
    {
      fields: ['prospectId']
    },
    {
      fields: ['receivedAt']
    }
  ]
});

module.exports = Email;
