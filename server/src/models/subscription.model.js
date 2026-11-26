const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {

  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'clients',
      key: 'id'
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },

  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0,
      max: 99999999.99
    }
  },

  billingCycle: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Mensuel',
    validate: {
      isIn: [[
        'Mensuel',
        'Trimestriel',
        'Annuel'
      ]]
    }
  },

  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'À venir',
    validate: {
      isIn: [[
        'À venir',
        'Actif',
        'Suspendu',
        'Résilié'
      ]]
    }
  },

  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: true
    }
  },

  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: null,
    validate: {
      isDate: true
    }
  },

  nextBillingDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: null,
    validate: {
      isDate: true
    }
  },

  autoRenew: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },

  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  }

}, {

  tableName: 'subscriptions',

  timestamps: true,

  indexes: [
    {
      fields: ['clientId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['nextBillingDate']
    }
  ],

  validate: {

    validEndDate() {

      if (
        this.startDate &&
        this.endDate &&
        this.endDate < this.startDate
      ) {

        throw new Error(
          'La date de fin ne peut pas être antérieure à la date de début.'
        );

      }

    },

    validNextBillingDate() {

      if (
        this.startDate &&
        this.nextBillingDate &&
        this.nextBillingDate < this.startDate
      ) {

        throw new Error(
          'La prochaine facturation ne peut pas être antérieure à la date de début.'
        );

      }

    }

  }

});

module.exports = Subscription;