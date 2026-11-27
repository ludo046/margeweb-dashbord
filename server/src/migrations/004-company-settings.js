const { QueryTypes } = require('sequelize');

module.exports = {

  name: '004-company-settings',

  async up({ sequelize, transaction }) {

    // ==========================================
    // PROTECTION DES DONNÉES EXISTANTES
    // ==========================================

    const protectedTables = [
      'prospects',
      'clients',
      'emails',
      'drafts',
      'interactions',
      'subscriptions',
      'quotes',
      'quote_items',
      'quote_sequences'
    ];

    const initialCounts = {};

    for (const table of protectedTables) {

      const [result] = await sequelize.query(
        `SELECT COUNT(*) AS count FROM "${table}"`,
        {
          type: QueryTypes.SELECT,
          transaction
        }
      );

      initialCounts[table] = Number(result.count);

    }

    // ==========================================
    // CRÉATION DE LA TABLE
    // ==========================================

    await sequelize.query(`

      CREATE TABLE company_settings (

        id INTEGER PRIMARY KEY
          CHECK (id = 1),

        tradeName VARCHAR(255) NOT NULL
          DEFAULT 'MargeWeb',

        legalName VARCHAR(255) NOT NULL
          DEFAULT '',

        legalForm VARCHAR(255) NOT NULL
          DEFAULT 'EI',

        siren VARCHAR(9) NOT NULL
          DEFAULT ''
          CHECK (
            siren = '' OR (
              length(siren) = 9
              AND siren NOT GLOB '*[^0-9]*'
            )
          ),

        siret VARCHAR(14) NOT NULL
          DEFAULT ''
          CHECK (
            siret = '' OR (
              length(siret) = 14
              AND siret NOT GLOB '*[^0-9]*'
            )
          ),

        apeCode VARCHAR(10) NOT NULL
          DEFAULT '',

        registrationMention VARCHAR(255) NOT NULL
          DEFAULT '',

        address VARCHAR(255) NOT NULL
          DEFAULT '',

        addressComplement VARCHAR(255) NOT NULL
          DEFAULT '',

        postalCode VARCHAR(20) NOT NULL
          DEFAULT '',

        city VARCHAR(255) NOT NULL
          DEFAULT '',

        country VARCHAR(255) NOT NULL
          DEFAULT 'France',

        email VARCHAR(255) NOT NULL
          DEFAULT 'contact@margeweb.fr',

        phone VARCHAR(255) NOT NULL
          DEFAULT '',

        website VARCHAR(255) NOT NULL
          DEFAULT 'https://margeweb.fr',

        logoPath VARCHAR(255) NOT NULL
          DEFAULT '',

        currency VARCHAR(3) NOT NULL
          DEFAULT 'EUR'
          CHECK (currency = 'EUR'),

        taxExempt BOOLEAN NOT NULL
          DEFAULT 1
          CHECK (taxExempt IN (0, 1)),

        vatNumber VARCHAR(255) NOT NULL
          DEFAULT '',

        taxMention VARCHAR(255) NOT NULL
          DEFAULT 'TVA non applicable, art. 293 B du CGI.',

        quoteValidityDays INTEGER NOT NULL
          DEFAULT 30
          CHECK (
            typeof(quoteValidityDays) = 'integer'
            AND quoteValidityDays BETWEEN 1 AND 365
          ),

        defaultQuotePaymentTerms TEXT NOT NULL
          DEFAULT '',

        defaultQuoteDeliveryTerms TEXT NOT NULL
          DEFAULT '',

        defaultQuoteTermsAndConditions TEXT NOT NULL
          DEFAULT '',

        defaultQuoteNotes TEXT NOT NULL
          DEFAULT '',

        legalInformationVerifiedAt DATETIME
          DEFAULT NULL,

        createdAt DATETIME NOT NULL,

        updatedAt DATETIME NOT NULL,

        CHECK (
          siren = ''
          OR siret = ''
          OR substr(siret, 1, 9) = siren
        )

      );

    `, { transaction });

    // ==========================================
    // INITIALISATION DE MARGEWEB
    // ==========================================

    const now = new Date().toISOString();

    await sequelize.query(`

      INSERT INTO company_settings (

        id,
        tradeName,
        legalName,
        legalForm,
        siren,
        siret,
        apeCode,
        address,
        postalCode,
        city,
        country,
        email,
        website,
        currency,
        taxExempt,
        taxMention,
        quoteValidityDays,
        legalInformationVerifiedAt,
        createdAt,
        updatedAt

      ) VALUES (

        1,
        :tradeName,
        :legalName,
        :legalForm,
        :siren,
        :siret,
        :apeCode,
        :address,
        :postalCode,
        :city,
        :country,
        :email,
        :website,
        :currency,
        1,
        :taxMention,
        30,
        NULL,
        :createdAt,
        :updatedAt

      );

    `, {

      replacements: {

        tradeName: 'MargeWeb',

        legalName: 'Ludovic Moissinac',

        legalForm: 'EI',

        siren: '804951804',

        siret: '80495180400033',

        apeCode: '62.01Z',

        address: 'Lotissement Guigon',

        postalCode: '48140',

        city: 'Le Malzieu-Ville',

        country: 'France',

        email: 'contact@margeweb.fr',

        website: 'https://margeweb.fr',

        currency: 'EUR',

        taxMention:
          'TVA non applicable, art. 293 B du CGI.',

        createdAt: now,

        updatedAt: now

      },

      transaction

    });

    // ==========================================
    // VÉRIFICATION DE LA CONFIGURATION
    // ==========================================

    const settings = await sequelize.query(`

      SELECT id, tradeName, legalInformationVerifiedAt
      FROM company_settings

    `, {

      type: QueryTypes.SELECT,

      transaction

    });

    if (
      settings.length !== 1 ||
      settings[0].id !== 1 ||
      settings[0].tradeName !== 'MargeWeb' ||
      settings[0].legalInformationVerifiedAt !== null
    ) {

      throw new Error(
        'Échec de l’initialisation de MargeWeb.'
      );

    }

    // ==========================================
    // VÉRIFICATION DES DONNÉES EXISTANTES
    // ==========================================

    for (const table of protectedTables) {

      const [result] = await sequelize.query(
        `SELECT COUNT(*) AS count FROM "${table}"`,
        {
          type: QueryTypes.SELECT,
          transaction
        }
      );

      if (
        Number(result.count) !== initialCounts[table]
      ) {

        throw new Error(
          `Le nombre de données de "${table}" a changé pendant la migration.`
        );

      }

    }

    // ==========================================
    // VÉRIFICATION DE L'INTÉGRITÉ SQLITE
    // ==========================================

    const integrity = await sequelize.query(
      'PRAGMA integrity_check;',
      {
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (
      integrity.length !== 1 ||
      Object.values(integrity[0])[0] !== 'ok'
    ) {

      throw new Error(
        'La vérification de l’intégrité SQLite a échoué.'
      );

    }

    const foreignKeyErrors = await sequelize.query(
      'PRAGMA foreign_key_check;',
      {
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (foreignKeyErrors.length > 0) {

      throw new Error(
        'Des incohérences de clés étrangères ont été détectées.'
      );

    }

    console.log(
      'Migration 004 : configuration MargeWeb initialisée.'
    );

  }

};