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
    allowNull: true,
    references: {
      model: 'prospects',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },

  clientId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'clients',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
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
    },

    {
      fields: ['clientId', 'occurredAt']
    }

  ],

  validate: {

    hasOwner() {

      if (
        this.prospectId == null &&
        this.clientId == null
      ) {

        throw new Error(
          'Une interaction doit être associée à un prospect ou à un client.'
        );

      }

    }

  }

});

module.exports = Interaction;