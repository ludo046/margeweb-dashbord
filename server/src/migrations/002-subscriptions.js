const { QueryTypes } = require('sequelize');

module.exports = {

  name: '002-subscriptions',

  async up({ sequelize, transaction }) {

    const execute = (sql) =>
      sequelize.query(sql, { transaction });

    const select = (sql) =>
      sequelize.query(sql, {
        type: QueryTypes.SELECT,
        transaction
      });

    // ==========================================
    // 1. COMPTAGE AVANT MIGRATION
    // ==========================================

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

    console.log(
      'Avant migration abonnements :',
      before
    );

    // ==========================================
    // 2. CRÉATION DE LA TABLE SUBSCRIPTIONS
    // ==========================================

    await execute(`
      CREATE TABLE subscriptions (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        clientId INTEGER NOT NULL
          REFERENCES clients(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        name VARCHAR(255) NOT NULL,

        description TEXT NOT NULL DEFAULT '',

        amount DECIMAL(10, 2) NOT NULL,

        billingCycle VARCHAR(255)
          NOT NULL DEFAULT 'Mensuel',

        status VARCHAR(255)
          NOT NULL DEFAULT 'À venir',

        startDate DATE NOT NULL,

        endDate DATE DEFAULT NULL,

        nextBillingDate DATE DEFAULT NULL,

        autoRenew TINYINT(1)
          NOT NULL DEFAULT 1,

        cancelledAt DATETIME DEFAULT NULL,

        notes TEXT NOT NULL DEFAULT '',

        createdAt DATETIME NOT NULL,

        updatedAt DATETIME NOT NULL,

        CHECK (
          LENGTH(TRIM(name)) > 0
        ),

        CHECK (
          amount >= 0
          AND amount <= 99999999.99
        ),

        CHECK (
          billingCycle IN (
            'Mensuel',
            'Trimestriel',
            'Annuel'
          )
        ),

        CHECK (
          status IN (
            'À venir',
            'Actif',
            'Suspendu',
            'Résilié'
          )
        ),

        CHECK (
          autoRenew IN (0, 1)
        ),

        CHECK (
          endDate IS NULL
          OR endDate >= startDate
        ),

        CHECK (
          nextBillingDate IS NULL
          OR nextBillingDate >= startDate
        )

      )
    `);

    console.log(
      'Table subscriptions créée.'
    );

    // ==========================================
    // 3. CRÉATION DES INDEX
    // ==========================================

    await execute(`
      CREATE INDEX subscriptions_client_id
      ON subscriptions(clientId)
    `);

    await execute(`
      CREATE INDEX subscriptions_status
      ON subscriptions(status)
    `);

    await execute(`
      CREATE INDEX subscriptions_next_billing_date
      ON subscriptions(nextBillingDate)
    `);

    console.log(
      'Index des abonnements créés.'
    );

    // ==========================================
    // 4. VÉRIFICATION DES DONNÉES EXISTANTES
    // ==========================================

    const after = await countRows();

    console.log(
      'Après migration abonnements :',
      after
    );

    for (const table of tables) {

      if (before[table] !== after[table]) {

        throw new Error(
          `Nombre d'enregistrements incorrect dans ${table}`
        );

      }

    }

    // ==========================================
    // 5. VÉRIFICATION DE LA NOUVELLE TABLE
    // ==========================================

    const [subscriptions] = await select(`
      SELECT COUNT(*) AS total
      FROM subscriptions
    `);

    if (Number(subscriptions.total) !== 0) {

      throw new Error(
        'La nouvelle table subscriptions devrait être vide.'
      );

    }

    // ==========================================
    // 6. VÉRIFICATION DE L'INTÉGRITÉ SQLITE
    // ==========================================

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

    console.log(
      'La table subscriptions est prête.'
    );

  }

};