
const sequelize = require('../config/database');
const Prospect = require('./prospect.model');
const Interaction = require('./interaction.model');

Prospect.hasMany(Interaction, {
  foreignKey: 'prospectId',
  as: 'interactions',
  onDelete: 'CASCADE'
});

Interaction.belongsTo(Prospect, {
  foreignKey: 'prospectId',
  as: 'prospect'
});

module.exports = {
  sequelize,
  Prospect,
  Interaction
};
