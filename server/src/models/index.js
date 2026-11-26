const sequelize = require('../config/database');

const Prospect = require('./prospect.model');
const Interaction = require('./interaction.model');
const Email = require('./email.model');
const Draft = require('./draft.model');
const Client = require('./client.model');

// ==========================================
// PROSPECTS / INTERACTIONS
// ==========================================

Prospect.hasMany(Interaction, {
  foreignKey: 'prospectId',
  as: 'interactions',
  onDelete: 'CASCADE'
});

Interaction.belongsTo(Prospect, {
  foreignKey: 'prospectId',
  as: 'prospect'
});

// ==========================================
// PROSPECTS / EMAILS
// ==========================================

Prospect.hasMany(Email, {
  foreignKey: 'prospectId',
  as: 'emails',
  onDelete: 'SET NULL'
});

Email.belongsTo(Prospect, {
  foreignKey: 'prospectId',
  as: 'prospect'
});

// ==========================================
// PROSPECTS / BROUILLONS
// ==========================================

Prospect.hasMany(Draft, {
  foreignKey: 'prospectId',
  as: 'drafts',
  onDelete: 'SET NULL'
});

Draft.belongsTo(Prospect, {
  foreignKey: 'prospectId',
  as: 'prospect'
});

// ==========================================
// EMAILS / BROUILLONS
// ==========================================

Email.hasMany(Draft, {
  foreignKey: 'originalEmailId',
  as: 'drafts',
  onDelete: 'SET NULL'
});

Draft.belongsTo(Email, {
  foreignKey: 'originalEmailId',
  as: 'originalEmail'
});

// ==========================================
// PROSPECTS / CLIENTS
// ==========================================

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

// ==========================================
// CLIENTS / INTERACTIONS
// ==========================================

Client.hasMany(Interaction, {
  foreignKey: 'clientId',
  as: 'interactions',
  onDelete: 'CASCADE'
});

Interaction.belongsTo(Client, {
  foreignKey: 'clientId',
  as: 'client',
  onDelete: 'CASCADE'
});

// ==========================================
// CLIENTS / EMAILS
// ==========================================

Client.hasMany(Email, {
  foreignKey: 'clientId',
  as: 'emails',
  onDelete: 'SET NULL'
});

Email.belongsTo(Client, {
  foreignKey: 'clientId',
  as: 'client',
  onDelete: 'SET NULL'
});

// ==========================================
// CLIENTS / BROUILLONS
// ==========================================

Client.hasMany(Draft, {
  foreignKey: 'clientId',
  as: 'drafts',
  onDelete: 'SET NULL'
});

Draft.belongsTo(Client, {
  foreignKey: 'clientId',
  as: 'client',
  onDelete: 'SET NULL'
});

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  sequelize,
  Prospect,
  Interaction,
  Email,
  Draft,
  Client
};