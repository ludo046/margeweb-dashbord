const sequelize = require('../config/database');

const Prospect = require('./prospect.model');
const Interaction = require('./interaction.model');
const Email = require('./email.model');
const Draft = require('./draft.model');
const Client = require('./client.model');

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

// Brouillons associés aux prospects

Prospect.hasMany(Draft, {
  foreignKey: 'prospectId',
  as: 'drafts',
  onDelete: 'SET NULL'
});

Draft.belongsTo(Prospect, {
  foreignKey: 'prospectId',
  as: 'prospect'
});

// Brouillons associés aux messages d'origine

Email.hasMany(Draft, {
  foreignKey: 'originalEmailId',
  as: 'drafts',
  onDelete: 'SET NULL'
});

Draft.belongsTo(Email, {
  foreignKey: 'originalEmailId',
  as: 'originalEmail'
});

// Conversion des prospects en clients

Prospect.hasOne(Client, {
  foreignKey: 'prospectId',
  as: 'client',
  onDelete: 'SET NULL'
});

Client.belongsTo(Prospect, {
  foreignKey: 'prospectId',
  as: 'prospect',
  onDelete: 'SET NULL'
});

module.exports = {
  sequelize,
  Prospect,
  Interaction,
  Email,
  Draft,
  Client
};