const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QuoteItem = sequelize.define(
  'QuoteItem',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    // Devis associé

    quoteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'quotes',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },

    // Ordre d'affichage dans le devis

    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0
      }
    },

    // Type de prestation

    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Ponctuelle',
      validate: {
        isIn: [[
          'Ponctuelle',
          'Récurrente'
        ]]
      }
    },

    // Informations de la prestation

    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },

    // Quantité

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        isInt: true,
        min: 1,
        max: 10000
      }
    },

    unit: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Forfait',
      validate: {
        notEmpty: true,
        len: [1, 50]
      }
    },

    // Prix unitaire en centimes

    unitPriceCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0,
        max: 9999999999
      }
    },

    // Montant avant remise

    subtotalCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0,
        max: Number.MAX_SAFE_INTEGER
      }
    },

    // Remise sur la ligne

    discountCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0,
        max: Number.MAX_SAFE_INTEGER
      }
    },

    // Montant final après remise

    totalCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0,
        max: Number.MAX_SAFE_INTEGER
      }
    },

    // Cycle de facturation
    // Uniquement pour les prestations récurrentes

    billingCycle: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      validate: {
        isIn: [[
          'Mensuel',
          'Trimestriel',
          'Annuel'
        ]]
      }
    },

    // Durée minimale d'engagement en mois
    // null = aucun engagement minimum

    commitmentMonths: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      validate: {
        isInt: true,
        min: 1,
        max: 120
      }
    },

    // Renouvellement prévu au contrat

    autoRenew: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },

  {
    tableName: 'quote_items',

    timestamps: true,

    indexes: [
      {
        fields: ['quoteId']
      },
      {
        fields: ['quoteId', 'position']
      },
      {
        fields: ['type']
      }
    ],

    validate: {

      validBillingCycle() {

        if (
          this.type === 'Récurrente' &&
          !this.billingCycle
        ) {
          throw new Error(
            'Une prestation récurrente doit posséder un cycle de facturation.'
          );
        }

        if (
          this.type === 'Ponctuelle' &&
          this.billingCycle !== null
        ) {
          throw new Error(
            'Une prestation ponctuelle ne doit pas posséder de cycle de facturation.'
          );
        }

      },

      validRecurringOptions() {

        if (this.type === 'Ponctuelle') {

          if (this.commitmentMonths !== null) {
            throw new Error(
              'Une prestation ponctuelle ne peut pas comporter de durée d’engagement.'
            );
          }

          if (this.autoRenew) {
            throw new Error(
              'Une prestation ponctuelle ne peut pas être renouvelée automatiquement.'
            );
          }

        }

      },

      validSubtotal() {

        const expectedSubtotal =
          this.quantity * this.unitPriceCents;

        if (!Number.isSafeInteger(expectedSubtotal)) {
          throw new Error(
            'Le montant de la prestation dépasse la limite autorisée.'
          );
        }

        if (this.subtotalCents !== expectedSubtotal) {
          throw new Error(
            'Le sous-total de la prestation est incorrect.'
          );
        }

      },

      validDiscount() {

        if (
          this.discountCents > this.subtotalCents
        ) {
          throw new Error(
            'La remise ne peut pas dépasser le montant de la prestation.'
          );
        }

      },

      validTotal() {

        const expectedTotal =
          this.subtotalCents - this.discountCents;

        if (this.totalCents !== expectedTotal) {
          throw new Error(
            'Le montant total de la prestation est incorrect.'
          );
        }

      }

    }
  }
);

module.exports = QuoteItem;

