const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CompanySettings = sequelize.define('CompanySettings', {

  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    defaultValue: 1,
    validate: {
      isIn: [[1]]
    }
  },

  // ==========================================
  // IDENTITÉ DE L'ENTREPRISE
  // ==========================================

  tradeName: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'MargeWeb'
  },

  legalName: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  legalForm: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'EI'
  },

  siren: {
    type: DataTypes.STRING(9),
    allowNull: false,
    defaultValue: '',
    validate: {
      is: /^(\d{9})?$/
    }
  },

  siret: {
    type: DataTypes.STRING(14),
    allowNull: false,
    defaultValue: '',
    validate: {
      is: /^(\d{14})?$/
    }
  },

  apeCode: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: ''
  },

  registrationMention: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  // ==========================================
  // COORDONNÉES
  // ==========================================

  address: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  addressComplement: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  postalCode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: ''
  },

  city: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  country: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'France'
  },

  email: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'contact@margeweb.fr',
    validate: {
      isEmail: true
    }
  },

  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  website: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'https://margeweb.fr'
  },

  logoPath: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  // ==========================================
  // FISCALITÉ
  // ==========================================

  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'EUR',
    validate: {
      isIn: [['EUR']]
    }
  },

  taxExempt: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },

  vatNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },

  taxMention: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue:
      'TVA non applicable, art. 293 B du CGI.'
  },

  // ==========================================
  // PARAMÈTRES DES DEVIS
  // ==========================================

  quoteValidityDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    validate: {
      isInt: true,
      min: 1,
      max: 365
    }
  },

  defaultQuotePaymentTerms: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },

  defaultQuoteDeliveryTerms: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },

  defaultQuoteTermsAndConditions: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },

  defaultQuoteNotes: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },

  // ==========================================
  // VÉRIFICATION DES INFORMATIONS LÉGALES
  // ==========================================

  legalInformationVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  }

}, {

  tableName: 'company_settings',

  timestamps: true,

  validate: {

    consistentRegistrationNumbers() {

      if (
        this.siren &&
        this.siret &&
        !this.siret.startsWith(this.siren)
      ) {

        throw new Error(
          'Le SIRET ne correspond pas au SIREN.'
        );

      }

    }

  }

});

module.exports = CompanySettings;