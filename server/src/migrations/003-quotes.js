const { QueryTypes } = require('sequelize');

module.exports = {
  name: '003-quotes',

  async up({ sequelize, transaction }) {

    const protectedTables = [
      'prospects',
      'clients',
      'emails',
      'drafts',
      'interactions',
      'subscriptions'
    ];

    const countRows = async (table) => {
      const [result] = await sequelize.query(
        `SELECT COUNT(*) AS count FROM "${table}"`,
        {
          type: QueryTypes.SELECT,
          transaction
        }
      );

      return Number(result.count);
    };

    // Vérification des données existantes

    const beforeCounts = {};

    for (const table of protectedTables) {
      beforeCounts[table] = await countRows(table);
    }

    console.log(
      'Données avant migration des devis :',
      beforeCounts
    );

    // Table principale des devis

    await sequelize.query(`
      CREATE TABLE "quotes" (

        "id" INTEGER PRIMARY KEY AUTOINCREMENT,

        "number" VARCHAR(50) UNIQUE,

        "prospectId" INTEGER,
        "clientId" INTEGER,

        "title" VARCHAR(255) NOT NULL
          CHECK (length(trim("title")) > 0),

        "status" VARCHAR(255) NOT NULL
          DEFAULT 'Brouillon'
          CHECK ("status" IN (
            'Brouillon',
            'Émis',
            'Envoyé',
            'Accepté',
            'Refusé',
            'Expiré',
            'Annulé'
          )),

        "issueDate" DATE,
        "validUntil" DATE,

        "recipientName" VARCHAR(255)
          NOT NULL DEFAULT '',

        "recipientLegalName" VARCHAR(255)
          NOT NULL DEFAULT '',

        "recipientContactName" VARCHAR(255)
          NOT NULL DEFAULT '',

        "recipientEmail" VARCHAR(255)
          NOT NULL DEFAULT '',

        "recipientPhone" VARCHAR(255)
          NOT NULL DEFAULT '',

        "recipientAddress" VARCHAR(255)
          NOT NULL DEFAULT '',

        "recipientPostalCode" VARCHAR(255)
          NOT NULL DEFAULT '',

        "recipientCity" VARCHAR(255)
          NOT NULL DEFAULT '',

        "recipientCountry" VARCHAR(255)
          NOT NULL DEFAULT 'France',

        "recipientSiret" VARCHAR(255)
          NOT NULL DEFAULT '',

        "issuerSnapshot" JSON,

        "currency" VARCHAR(3)
          NOT NULL DEFAULT 'EUR'
          CHECK ("currency" = 'EUR'),

        "subtotalCents" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("subtotalCents") = 'integer'
            AND "subtotalCents" BETWEEN 0 AND 9007199254740991
          ),

        "discountCents" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("discountCents") = 'integer'
            AND "discountCents" BETWEEN 0 AND "subtotalCents"
          ),

        "totalExcludingTaxCents" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("totalExcludingTaxCents") = 'integer'
            AND "totalExcludingTaxCents"
              BETWEEN 0 AND 9007199254740991
          ),

        "taxCents" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("taxCents") = 'integer'
            AND "taxCents" BETWEEN 0 AND 9007199254740991
          ),

        "totalIncludingTaxCents" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("totalIncludingTaxCents") = 'integer'
            AND "totalIncludingTaxCents"
              BETWEEN 0 AND 9007199254740991
          ),

        "taxExempt" BOOLEAN
          NOT NULL DEFAULT 1
          CHECK ("taxExempt" IN (0, 1)),

        "taxMention" VARCHAR(255)
          NOT NULL DEFAULT
          'TVA non applicable, art. 293 B du CGI.',

        "paymentTerms" TEXT NOT NULL DEFAULT '',
        "deliveryTerms" TEXT NOT NULL DEFAULT '',
        "termsAndConditions" TEXT NOT NULL DEFAULT '',

        "publicNotes" TEXT NOT NULL DEFAULT '',
        "internalNotes" TEXT NOT NULL DEFAULT '',

        "issuedAt" DATETIME,
        "sentAt" DATETIME,
        "acceptedAt" DATETIME,
        "refusedAt" DATETIME,
        "cancelledAt" DATETIME,

        "refusalReason" TEXT NOT NULL DEFAULT '',
        "cancellationReason" TEXT NOT NULL DEFAULT '',

        "createdAt" DATETIME NOT NULL,
        "updatedAt" DATETIME NOT NULL,

        FOREIGN KEY ("prospectId")
          REFERENCES "prospects" ("id")
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        FOREIGN KEY ("clientId")
          REFERENCES "clients" ("id")
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        CHECK (
          "prospectId" IS NOT NULL
          OR "clientId" IS NOT NULL
        ),

        CHECK (
          "issueDate" IS NULL
          OR "validUntil" IS NULL
          OR "validUntil" >= "issueDate"
        ),

        CHECK (
          "totalExcludingTaxCents" =
          "subtotalCents" - "discountCents"
        ),

        CHECK (
          "totalIncludingTaxCents" =
          "totalExcludingTaxCents" + "taxCents"
        ),

        CHECK (
          "taxExempt" = 0
          OR "taxCents" = 0
        )

      )
    `, { transaction });

    // Lignes de prestations

    await sequelize.query(`
      CREATE TABLE "quote_items" (

        "id" INTEGER PRIMARY KEY AUTOINCREMENT,

        "quoteId" INTEGER NOT NULL,

        "position" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("position") = 'integer'
            AND "position" >= 0
          ),

        "type" VARCHAR(255)
          NOT NULL DEFAULT 'Ponctuelle'
          CHECK ("type" IN (
            'Ponctuelle',
            'Récurrente'
          )),

        "name" VARCHAR(255) NOT NULL
          CHECK (
            length(trim("name")) BETWEEN 1 AND 255
          ),

        "description" TEXT NOT NULL DEFAULT '',

        "quantity" INTEGER
          NOT NULL DEFAULT 1
          CHECK (
            typeof("quantity") = 'integer'
            AND "quantity" BETWEEN 1 AND 10000
          ),

        "unit" VARCHAR(50)
          NOT NULL DEFAULT 'Forfait'
          CHECK (
            length(trim("unit")) BETWEEN 1 AND 50
          ),

        "unitPriceCents" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("unitPriceCents") = 'integer'
            AND "unitPriceCents" BETWEEN 0 AND 9999999999
          ),

        "subtotalCents" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("subtotalCents") = 'integer'
            AND "subtotalCents"
              BETWEEN 0 AND 9007199254740991
          ),

        "discountCents" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("discountCents") = 'integer'
            AND "discountCents"
              BETWEEN 0 AND "subtotalCents"
          ),

        "totalCents" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("totalCents") = 'integer'
            AND "totalCents"
              BETWEEN 0 AND 9007199254740991
          ),

        "billingCycle" VARCHAR(255)
          CHECK (
            "billingCycle" IS NULL
            OR "billingCycle" IN (
              'Mensuel',
              'Trimestriel',
              'Annuel'
            )
          ),

        "commitmentMonths" INTEGER
          CHECK (
            "commitmentMonths" IS NULL
            OR (
              typeof("commitmentMonths") = 'integer'
              AND "commitmentMonths" BETWEEN 1 AND 120
            )
          ),

        "autoRenew" BOOLEAN
          NOT NULL DEFAULT 0
          CHECK ("autoRenew" IN (0, 1)),

        "createdAt" DATETIME NOT NULL,
        "updatedAt" DATETIME NOT NULL,

        FOREIGN KEY ("quoteId")
          REFERENCES "quotes" ("id")
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CHECK (
          "subtotalCents" =
          "quantity" * "unitPriceCents"
        ),

        CHECK (
          "totalCents" =
          "subtotalCents" - "discountCents"
        ),

        CHECK (
          (
            "type" = 'Ponctuelle'
            AND "billingCycle" IS NULL
            AND "commitmentMonths" IS NULL
            AND "autoRenew" = 0
          )
          OR
          (
            "type" = 'Récurrente'
            AND "billingCycle" IS NOT NULL
          )
        )

      )
    `, { transaction });

    // Compteur annuel de numérotation

    await sequelize.query(`
      CREATE TABLE "quote_sequences" (

        "year" INTEGER PRIMARY KEY
          CHECK ("year" BETWEEN 2000 AND 9999),

        "lastNumber" INTEGER
          NOT NULL DEFAULT 0
          CHECK (
            typeof("lastNumber") = 'integer'
            AND "lastNumber" BETWEEN 0 AND 9007199254740991
          ),

        "createdAt" DATETIME NOT NULL,
        "updatedAt" DATETIME NOT NULL

      )
    `, { transaction });

    // Index des devis

    const indexes = [
      `
        CREATE INDEX "quotes_prospect_id"
        ON "quotes" ("prospectId")
      `,
      `
        CREATE INDEX "quotes_client_id"
        ON "quotes" ("clientId")
      `,
      `
        CREATE INDEX "quotes_status"
        ON "quotes" ("status")
      `,
      `
        CREATE INDEX "quotes_issue_date"
        ON "quotes" ("issueDate")
      `,
      `
        CREATE INDEX "quotes_valid_until"
        ON "quotes" ("validUntil")
      `,
      `
        CREATE INDEX "quote_items_quote_id"
        ON "quote_items" ("quoteId")
      `,
      `
        CREATE INDEX "quote_items_quote_id_position"
        ON "quote_items" ("quoteId", "position")
      `,
      `
        CREATE INDEX "quote_items_type"
        ON "quote_items" ("type")
      `
    ];

    for (const sql of indexes) {
      await sequelize.query(sql, { transaction });
    }

    // Vérification des données existantes

    const afterCounts = {};

    for (const table of protectedTables) {

      afterCounts[table] = await countRows(table);

      if (beforeCounts[table] !== afterCounts[table]) {
        throw new Error(
          `Migration interrompue : le nombre de lignes ` +
          `de la table "${table}" a changé.`
        );
      }

    }

    console.log(
      'Données après migration des devis :',
      afterCounts
    );

    // Vérification des nouvelles tables

    const newTables = [
      'quotes',
      'quote_items',
      'quote_sequences'
    ];

    for (const table of newTables) {

      const count = await countRows(table);

      if (count !== 0) {
        throw new Error(
          `La nouvelle table "${table}" devrait être vide.`
        );
      }

    }

    // Vérification de l'intégrité SQLite

    const integrity = await sequelize.query(
      'PRAGMA integrity_check',
      {
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (
      integrity.length !== 1 ||
      integrity[0].integrity_check !== 'ok'
    ) {
      throw new Error(
        'Échec de la vérification d’intégrité SQLite.'
      );
    }

    // Vérification des clés étrangères

    const foreignKeyErrors = await sequelize.query(
      'PRAGMA foreign_key_check',
      {
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (foreignKeyErrors.length > 0) {
      throw new Error(
        'Des relations invalides ont été détectées.'
      );
    }

    console.log('Table quotes créée.');
    console.log('Table quote_items créée.');
    console.log('Table quote_sequences créée.');
    console.log('Intégrité SQLite vérifiée.');
    console.log('Migration des devis terminée.');

  }
};
