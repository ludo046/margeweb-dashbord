const { QueryTypes } = require('sequelize');

module.exports = {

  name: '000-initial-schema',

  async up({ sequelize, transaction }) {

    const execute = (sql) =>
      sequelize.query(sql, { transaction });

    const existingTables = await sequelize.query(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
    `, {
      type: QueryTypes.SELECT,
      transaction
    });

    const expectedTables = [
      'prospects',
      'clients',
      'interactions',
      'emails',
      'drafts'
    ];

    const existingNames = existingTables.map(
      table => table.name
    );

    const existingCount = expectedTables.filter(
      table => existingNames.includes(table)
    ).length;

    // Base existante : aucune reconstruction

    if (existingCount === expectedTables.length) {

      console.log('Structure initiale déjà présente');

      return;

    }

    // Protection contre une installation incomplète

    if (existingCount > 0) {

      throw new Error(
        'Structure initiale incomplète. Vérification manuelle nécessaire.'
      );

    }

    // PROSPECTS

    await execute(`
      CREATE TABLE prospects (

        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        phone VARCHAR(255) DEFAULT '',
        website VARCHAR(255) DEFAULT '',
        status VARCHAR(255) NOT NULL DEFAULT 'À contacter',
        notes TEXT DEFAULT '',
        needs TEXT DEFAULT '',
        creationQuote DECIMAL(10,2),
        monthlySubscription DECIMAL(10,2),
        firstContact DATE,
        nextFollowUp DATE,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL

      )
    `);

    // CLIENTS

    await execute(`
      CREATE TABLE clients (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        prospectId INTEGER UNIQUE
          REFERENCES prospects(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,

        name VARCHAR(255) NOT NULL,
        legalName VARCHAR(255) DEFAULT '',
        contactName VARCHAR(255) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        phone VARCHAR(255) DEFAULT '',
        website VARCHAR(255) DEFAULT '',
        address VARCHAR(255) DEFAULT '',
        postalCode VARCHAR(255) DEFAULT '',
        city VARCHAR(255) DEFAULT '',
        country VARCHAR(255) DEFAULT 'France',
        siret VARCHAR(255) DEFAULT '',
        status VARCHAR(255) NOT NULL DEFAULT 'Actif',
        clientSince DATE,
        notes TEXT DEFAULT '',
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL

      )
    `);

    // INTERACTIONS

    await execute(`
      CREATE TABLE interactions (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        prospectId INTEGER NOT NULL
          REFERENCES prospects(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        type VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        content TEXT DEFAULT '',
        occurredAt DATETIME NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL

      )
    `);

    await execute(`
      CREATE INDEX interactions_prospect_id_occurred_at
      ON interactions(prospectId, occurredAt)
    `);

    // EMAILS

    await execute(`
      CREATE TABLE emails (

        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid INTEGER NOT NULL,
        uidValidity VARCHAR(255) NOT NULL,
        messageId VARCHAR(255),
        folder VARCHAR(255) NOT NULL DEFAULT 'INBOX',
        fromName VARCHAR(255) DEFAULT '',
        fromEmail VARCHAR(255) DEFAULT '',
        toEmail TEXT DEFAULT '',
        subject VARCHAR(255) DEFAULT '',
        textContent TEXT DEFAULT '',
        htmlContent TEXT DEFAULT '',
        receivedAt DATETIME NOT NULL,
        isRead TINYINT(1) DEFAULT 0,
        hasAttachments TINYINT(1) DEFAULT 0,

        prospectId INTEGER
          REFERENCES prospects(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,

        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL

      )
    `);

    await execute(`
      CREATE UNIQUE INDEX emails_folder_uid_validity_uid
      ON emails(folder, uidValidity, uid)
    `);

    await execute(`
      CREATE INDEX emails_message_id
      ON emails(messageId)
    `);

    await execute(`
      CREATE INDEX emails_prospect_id
      ON emails(prospectId)
    `);

    await execute(`
      CREATE INDEX emails_received_at
      ON emails(receivedAt)
    `);

    // BROUILLONS

    await execute(`
      CREATE TABLE drafts (

        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode VARCHAR(255) NOT NULL DEFAULT 'new',
        toEmail VARCHAR(255) NOT NULL DEFAULT '',
        subject VARCHAR(255) NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',

        prospectId INTEGER
          REFERENCES prospects(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,

        originalEmailId INTEGER
          REFERENCES emails(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,

        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL

      )
    `);

    await execute(`
      CREATE INDEX drafts_prospect_id
      ON drafts(prospectId)
    `);

    await execute(`
      CREATE INDEX drafts_original_email_id
      ON drafts(originalEmailId)
    `);

    await execute(`
      CREATE INDEX drafts_updated_at
      ON drafts(updatedAt)
    `);

    console.log('Structure initiale créée');

  }

};