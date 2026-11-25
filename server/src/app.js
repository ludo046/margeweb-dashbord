
const express = require('express');
const cors = require('cors');

const { sequelize } = require('./models');
const prospectRoutes = require('./routes/prospect.routes');
const errorMiddleware = require('./middlewares/error.middleware');
const interactionRoutes = require('./routes/interaction.routes');
const emailRoutes = require('./routes/email.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200'
}));

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'MargeWeb CRM API opérationnelle'
  });
});

// Routes API
app.use('/api/prospects', prospectRoutes);
app.use(
  '/api/prospects/:prospectId/interactions',
  interactionRoutes
);
app.use('/api/emails', emailRoutes);

// Route introuvable
app.use((req, res) => {
  res.status(404).json({
    message: 'Route introuvable'
  });
});

// Gestion centralisée des erreurs
app.use(errorMiddleware);

async function startServer() {
  try {
    await sequelize.authenticate();

    console.log('Connexion SQLite réussie');

    await sequelize.sync();

    console.log('Modèles Sequelize synchronisés');

    app.listen(PORT, '127.0.0.1', () => {
      console.log(
        `API MargeWeb disponible sur http://localhost:${PORT}`
      );
    });

  } catch (error) {
    console.error('Erreur de démarrage :', error);
    process.exit(1);
  }
}

startServer();
