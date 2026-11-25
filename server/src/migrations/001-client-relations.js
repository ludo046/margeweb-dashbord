const { QueryTypes } = require('sequelize');

module.exports = {

  name: '001-client-relations',

  async up({ sequelize, transaction }) {

    const execute = (sql) =>
      sequelize.query(sql, { transaction });

    const select = (sql) =>
      sequelize.query(sql, {
        type: QueryTypes.SELECT,
        transaction
      });

    // Comptage avant migration

    const tables = [
      'prospects',
      'clients',
      'emails',
      'drafts',
      'interactions'
    ];

    async function countRows() {

      const counts = {};

      for (const table of tables) {

        const [result] = await select(
          `SELECT COUNT(*) AS total FROM "${table}"`
        );

        counts[table] = Number(result.total);

      }

      return counts;

    }

    const before = await countRows();

    console.log('Avant migration :', before);

    // 1. Relations clients dans les emails

    await execute(`
      ALTER TABLE emails
      ADD COLUMN clientId INTEGER
      REFERENCES clients(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE
    `);

    await execute(`
      CREATE INDEX emails_client_id
      ON emails(clientId)
    `);

    // 2. Relations clients dans les brouillons

    await execute(`
      ALTER TABLE drafts
      ADD COLUMN clientId INTEGER
      REFERENCES clients(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE
    `);

    await execute(`
      CREATE INDEX drafts_client_id
      ON drafts(clientId)
    `);

    // 3. Conservation de la séquence des interactions

    const [sequence] = await select(`
      SELECT seq
      FROM sqlite_sequence
      WHERE name = 'interactions'
    `);

    const previousSequence = Number(
      sequence?.seq ?? 0
    );

    // 4. Nouvelle structure des interactions

    await execute(`
      CREATE TABLE interactions_new (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        prospectId INTEGER
          REFERENCES prospects(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        clientId INTEGER
          REFERENCES clients(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        type VARCHAR(255) NOT NULL,

        subject VARCHAR(255) NOT NULL,

        content TEXT DEFAULT '',

        occurredAt DATETIME NOT NULL,

        createdAt DATETIME NOT NULL,

        updatedAt DATETIME NOT NULL,

        CHECK (
          prospectId IS NOT NULL
          OR clientId IS NOT NULL
        )

      )
    `);

    // 5. Transfert de toutes les interactions

    await execute(`
      INSERT INTO interactions_new (
        id,
        prospectId,
        clientId,
        type,
        subject,
        content,
        occurredAt,
        createdAt,
        updatedAt
      )
      SELECT
        interactions.id,
        interactions.prospectId,
        clients.id,
        interactions.type,
        interactions.subject,
        interactions.content,
        interactions.occurredAt,
        interactions.createdAt,
        interactions.updatedAt
      FROM interactions
      LEFT JOIN clients
        ON clients.prospectId = interactions.prospectId
    `);

    // Vérification avant remplacement

    const [copied] = await select(`
      SELECT COUNT(*) AS total
      FROM interactions_new
    `);

    if (Number(copied.total) !== before.interactions) {

      throw new Error(
        'Le nombre d’interactions copiées est incorrect.'
      );

    }

    // 6. Remplacement de la table

    await execute(`
      DROP TABLE interactions
    `);

    await execute(`
      ALTER TABLE interactions_new
      RENAME TO interactions
    `);

    // 7. Restauration de la séquence

    const [maxId] = await select(`
      SELECT COALESCE(MAX(id), 0) AS total
      FROM interactions
    `);

    const nextSequence = Math.max(
      previousSequence,
      Number(maxId.total)
    );

    await sequelize.query(`
      DELETE FROM sqlite_sequence
      WHERE name IN (
        'interactions',
        'interactions_new'
      )
    `, { transaction });

    await sequelize.query(`
      INSERT INTO sqlite_sequence (name, seq)
      VALUES ('interactions', :sequence)
    `, {
      replacements: {
        sequence: nextSequence
      },
      transaction
    });

    // 8. Restauration des index

    await execute(`
      CREATE INDEX interactions_prospect_id_occurred_at
      ON interactions(prospectId, occurredAt)
    `);

    await execute(`
      CREATE INDEX interactions_client_id_occurred_at
      ON interactions(clientId, occurredAt)
    `);

    // 9. Rattachement des anciens emails

    await execute(`
      UPDATE emails
      SET clientId = (
        SELECT clients.id
        FROM clients
        WHERE clients.prospectId = emails.prospectId
      )
      WHERE prospectId IS NOT NULL
        AND clientId IS NULL
    `);

    // 10. Rattachement des anciens brouillons

    await execute(`
      UPDATE drafts
      SET clientId = (
        SELECT clients.id
        FROM clients
        WHERE clients.prospectId = drafts.prospectId
      )
      WHERE prospectId IS NOT NULL
        AND clientId IS NULL
    `);

    // 11. Vérification du nombre d'enregistrements

    const after = await countRows();

    console.log('Après migration :', after);

    for (const table of tables) {

      if (before[table] !== after[table]) {

        throw new Error(
          `Nombre d'enregistrements incorrect dans ${table}`
        );

      }

    }

    // 12. Vérification de l'intégrité SQLite

    const integrity = await select(`
      PRAGMA integrity_check
    `);

    if (
      integrity.length !== 1 ||
      Object.values(integrity[0])[0] !== 'ok'
    ) {

      throw new Error(
        'La vérification d’intégrité SQLite a échoué.'
      );

    }

    console.log(
      'Toutes les données existantes ont été conservées en nombre.'
    );

  }

};