
const sequelize = require('../config/database');

const Prospect = require('./prospect.model');
const Interaction = require('./interaction.model');
const Email = require('./email.model');

// Historique commercial
Prospect.hasMany(Interaction, {
  foreignKey: 'prospectId',
  as: 'interactions',
  onDelete: 'CASCADE'
});

Interaction.belongsTo(Prospect, {
  foreignKey: 'prospectId',
  as: 'prospect'
});

// Messagerie
Prospect.hasMany(Email, {
  foreignKey: 'prospectId',
  as: 'emails',
  onDelete: 'SET NULL'
});

Email.belongsTo(Prospect, {
  foreignKey: 'prospectId',
  as: 'prospect'
});

module.exports = {
  sequelize,
  Prospect,
  Interaction,
  Email
};
