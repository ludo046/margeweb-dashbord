
const { ValidationError } = require('sequelize');

module.exports = (error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.errors.map(item => ({
        field: item.path,
        message: item.message
      }))
    });
  }

  if (error.status === 400) {
    return res.status(400).json({
      message: 'Requête invalide'
    });
  }

  res.status(500).json({
    message: 'Une erreur interne est survenue'
  });
};
