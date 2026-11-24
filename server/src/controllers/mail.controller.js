
const { Prospect, Interaction } = require('../models');
const mailService = require('../services/mail.service');

exports.sendToProspect = async (req, res, next) => {
  try {
    const prospect = await Prospect.findByPk(req.params.id);

    if (!prospect) {
      return res.status(404).json({
        message: 'Prospect introuvable.'
      });
    }

    if (!prospect.email || !prospect.email.trim()) {
      return res.status(400).json({
        message: 'Ce prospect ne possède pas d’adresse e-mail.'
      });
    }

    const { subject, content } = req.body || {};

    if (
      typeof subject !== 'string' ||
      typeof content !== 'string' ||
      !subject.trim() ||
      !content.trim() ||
      subject.length > 255 ||
      /[\r\n]/.test(subject)
    ) {
      return res.status(400).json({
        message: 'Le sujet ou le contenu est invalide.'
      });
    }

    const recipient = prospect.email.trim();

    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)) {
      return res.status(400).json({
        message: 'Adresse e-mail invalide.'
      });
    }

    const result = await mailService.sendMail({
      to: recipient,
      subject: subject.trim(),
      text: content.trim()
    });

    if (!result.accepted?.length) {
      return res.status(502).json({
        message: 'Le serveur SMTP a refusé le destinataire.'
      });
    }

    try {
      const interaction = await Interaction.create({
        prospectId: prospect.id,
        type: 'email_sent',
        subject: subject.trim(),
        content: content.trim()
      });

      res.status(201).json({
        success: true,
        message: 'E-mail accepté par le serveur SMTP.',
        messageId: result.messageId,
        interaction
      });

    } catch (historyError) {
      console.error(historyError);

      res.status(200).json({
        success: true,
        warning: 'E-mail envoyé, mais historique non enregistré. Ne pas renvoyer.',
        messageId: result.messageId
      });
    }

  } catch (error) {
    next(error);
  }
};
