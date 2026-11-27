const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Quote = sequelize.define(
  'Quote',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    // Numérotation

    number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      defaultValue: null
    },

    // Association commerciale

    prospectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'prospects',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    },

    clientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'clients',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    },

    // Informations générales

    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Brouillon',
      validate: {
        isIn: [[
          'Brouillon',
          'Émis',
          'Envoyé',
          'Accepté',
          'Refusé',
          'Expiré',
          'Annulé'
        ]]
      }
    },

    issueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },

    validUntil: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },

    // Coordonnées du destinataire

    recipientName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },

    recipientLegalName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },

    recipientContactName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },

    recipientEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },

    recipientPhone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },

    recipientAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },

    recipientPostalCode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },

    recipientCity: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },

    recipientCountry: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'France'
    },

    recipientSiret: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },

    // Informations légales de MargeWeb
    // Copie figée au moment de l'émission

    issuerSnapshot: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },

    // Devise

    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'EUR',
      validate: {
        isIn: [['EUR']]
      }
    },

    // Montants ponctuels
    // Stockage en centimes pour éviter les erreurs d'arrondi

    subtotalCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0
      }
    },

    discountCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0
      }
    },

    totalExcludingTaxCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0
      }
    },

    taxCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0
      }
    },

    totalIncludingTaxCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0
      }
    },

    // Régime de TVA

    taxExempt: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },

    taxMention: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'TVA non applicable, art. 293 B du CGI.'
    },

    // Conditions commerciales

    paymentTerms: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },

    deliveryTerms: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },

    termsAndConditions: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },

    // Notes visibles par le destinataire

    publicNotes: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },

    // Notes internes au CRM

    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },

    // Historique du cycle de vie

    issuedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    sentAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    refusedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    refusalReason: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },

    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    }
  },

  {
    tableName: 'quotes',

    timestamps: true,

    indexes: [
      {
        fields: ['prospectId']
      },
      {
        fields: ['clientId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['issueDate']
      },
      {
        fields: ['validUntil']
      }
    ],

    validate: {
      hasRecipient() {
        if (
          this.prospectId == null &&
          this.clientId == null
        ) {
          throw new Error(
            'Le devis doit être associé à un prospect ou à un client.'
          );
        }
      },

      validDates() {
        if (
          this.issueDate &&
          this.validUntil &&
          this.validUntil < this.issueDate
        ) {
          throw new Error(
            'La date de validité ne peut pas précéder la date d’émission.'
          );
        }
      },

      validDiscount() {
        if (
          this.discountCents > this.subtotalCents
        ) {
          throw new Error(
            'La remise ne peut pas dépasser le sous-total.'
          );
        }
      },

      validTotals() {
        if (
          this.totalExcludingTaxCents !==
          this.subtotalCents - this.discountCents
        ) {
          throw new Error(
            'Le total hors taxes est incorrect.'
          );
        }

        if (
          this.totalIncludingTaxCents !==
          this.totalExcludingTaxCents + this.taxCents
        ) {
          throw new Error(
            'Le total toutes taxes comprises est incorrect.'
          );
        }

        if (
          this.taxExempt &&
          this.taxCents !== 0
        ) {
          throw new Error(
            'Un devis en franchise de TVA ne doit pas comporter de TVA.'
          );
        }
      }
    }
  }
);

module.exports = Quote;

