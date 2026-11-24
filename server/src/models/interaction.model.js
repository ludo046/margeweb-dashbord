
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Interaction = sequelize.define('Interaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  prospectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'prospects',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },

  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [[
        'email_sent',
        'email_received',
        'call',
        'follow_up',
        'meeting',
        'note',
        'status_change'
      ]]
    }
  },

  subject: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },

  content: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },

  occurredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }

}, {
  tableName: 'interactions',
  timestamps: true,
  indexes: [
    {
      fields: ['prospectId', 'occurredAt']
    }
  ]
});

module.exports = Interaction;
