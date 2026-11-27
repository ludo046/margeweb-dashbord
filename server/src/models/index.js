const sequelize = require('../config/database');

const Prospect = require('./prospect.model');
const Interaction = require('./interaction.model');
const Email = require('./email.model');
const Draft = require('./draft.model');
const Client = require('./client.model');
const Subscription = require('./subscription.model');
const Quote = require('./quote.model');
const QuoteItem = require('./quote-item.model');
const QuoteSequence = require('./quote-sequence.model');
const CompanySettings = require('./company-settings.model');

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
// CLIENTS / ABONNEMENTS
// ==========================================

Client.hasMany(Subscription, {
  foreignKey: {
    name: 'clientId',
    allowNull: false
  },
  as: 'subscriptions',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

Subscription.belongsTo(Client, {
  foreignKey: {
    name: 'clientId',
    allowNull: false
  },
  as: 'client',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

// ==========================================
// PROSPECTS / DEVIS
// ==========================================

Prospect.hasMany(Quote, {
  foreignKey: {
    name: 'prospectId',
    allowNull: true
  },
  as: 'quotes',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

Quote.belongsTo(Prospect, {
  foreignKey: {
    name: 'prospectId',
    allowNull: true
  },
  as: 'prospect',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

// ==========================================
// CLIENTS / DEVIS
// ==========================================

Client.hasMany(Quote, {
  foreignKey: {
    name: 'clientId',
    allowNull: true
  },
  as: 'quotes',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

Quote.belongsTo(Client, {
  foreignKey: {
    name: 'clientId',
    allowNull: true
  },
  as: 'client',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

// ==========================================
// DEVIS / LIGNES DE PRESTATIONS
// ==========================================

Quote.hasMany(QuoteItem, {
  foreignKey: {
    name: 'quoteId',
    allowNull: false
  },
  as: 'items',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

QuoteItem.belongsTo(Quote, {
  foreignKey: {
    name: 'quoteId',
    allowNull: false
  },
  as: 'quote',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
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
  Client,
  Subscription,
  Quote,
  QuoteItem,
  QuoteSequence,
  CompanySettings
};