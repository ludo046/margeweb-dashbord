const {
  ValidationError,
  UniqueConstraintError,
  ForeignKeyConstraintError
} = require('sequelize');

module.exports = (error, req, res, next) => {

  if (res.headersSent) {

    return next(error);

  }

  // Contrainte d'unicité

  if (error instanceof UniqueConstraintError) {

    return res.status(409).json({

      message: 'Cette donnée existe déjà.',

      errors: error.errors.map(item => ({
        field: item.path,
        message: item.message
      }))

    });

  }

  // Contrainte de relation

  if (error instanceof ForeignKeyConstraintError) {

    return res.status(409).json({

      message:
        'Cette opération est impossible en raison des données associées.'

    });

  }

  // Validation Sequelize

  if (error instanceof ValidationError) {

    return res.status(400).json({

      message: 'Données invalides.',

      errors: error.errors.map(item => ({
        field: item.path,
        message: item.message
      }))

    });

  }

  // Erreurs HTTP personnalisées

  const status = error.status || error.statusCode;

  if (
    Number.isInteger(status) &&
    status >= 400 &&
    status < 500
  ) {

    return res.status(status).json({

      message: error.message || 'Requête invalide.'

    });

  }

  // Service indisponible

  if (status === 503) {

    return res.status(503).json({

      message: error.message || 'Service indisponible.'

    });

  }

  // Erreur interne inattendue

  console.error('Erreur API :', error);

  return res.status(500).json({

    message: 'Une erreur interne est survenue.'

  });

};