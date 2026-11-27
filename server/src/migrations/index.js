const { DataTypes, QueryTypes } = require('sequelize');

const sequelize = require('../config/database');

// Liste des migrations dans leur ordre d'exécution

const migrations = [
  require('./000-initial-schema'),
  require('./001-client-relations'),
  require('./002-subscriptions'),
  require('./003-quotes'),
  require('./004-company-settings')
];

// Table de suivi des migrations

const Migration = sequelize.define('Migration', {

  name: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },

  executedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }

}, {

  tableName: 'schema_migrations',
  timestamps: false

});

// Exécution des migrations

async function runMigrations() {

  await Migration.sync();

  const executedMigrations = await Migration.findAll({
    raw: true
  });

  const executedNames = new Set(
    executedMigrations.map(migration => migration.name)
  );

  const queryInterface = sequelize.getQueryInterface();

  for (const migration of migrations) {

    if (executedNames.has(migration.name)) {

      console.log(
        `Migration déjà appliquée : ${migration.name}`
      );

      continue;

    }

    console.log(
      `Exécution de la migration : ${migration.name}`
    );

    await sequelize.transaction(async transaction => {

      await migration.up({
        sequelize,
        queryInterface,
        transaction
      });

      const violations = await sequelize.query(
        'PRAGMA foreign_key_check',
        {
          type: QueryTypes.SELECT,
          transaction
        }
      );

      if (violations.length > 0) {

        throw new Error(
          `Violation des clés étrangères : ${
            JSON.stringify(violations)
          }`
        );

      }

      await Migration.create({

        name: migration.name,
        executedAt: new Date()

      }, {

        transaction

      });

    });

    console.log(
      `Migration terminée : ${migration.name}`
    );

  }

  console.log('Migrations SQLite à jour');

}

module.exports = runMigrations;