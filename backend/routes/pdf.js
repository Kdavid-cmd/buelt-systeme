/**
 * backend/routes/pdf.js
 * POST /api/pdf/generer  → génère un PDF et renvoie son chemin
 * GET  /api/pdf/:fichier → télécharge un PDF généré
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { genererPdfRecu } = require('../services/pdfService');
const { trouverCalcul } = require('../models/calcul');
const logger = require('../services/loggerService');

const GENERATED_DIR = (global.APP_PATHS && global.APP_PATHS.GENERATED_DIR) || path.resolve(path.join(__dirname, '..', '..', 'generated'));

// ── Générer un PDF depuis les données d'un calcul (id ou payload) ───
router.post('/generer', async (req, res) => {
  try {
    let data = req.body;

    // Si un id est fourni, charger depuis la DB
    if (data.id) {
      const calcul = trouverCalcul(parseInt(data.id));
      if (!calcul) return res.status(404).json({ ok: false, error: 'Calcul introuvable' });
      data = { ...calcul, ...data }; // les champs du body écrasent la DB si présents
    }

    const pdfPath = await genererPdfRecu(data);
    const fileName = path.basename(pdfPath);

    logger.info(`PDF généré : ${fileName}`);
    res.json({ ok: true, fichier: fileName, url: `/api/pdf/${fileName}` });
  } catch (err) {
    logger.error('Erreur génération PDF:', err.message);
    const isValidationError = /numéro de reçu ni waybill/.test(err.message);
    res.status(isValidationError ? 400 : 500).json({ ok: false, error: err.message });
  }
});

// ── Télécharger un PDF généré ───────────────────────────────────────
router.get('/:fichier', (req, res) => {
  const fileName = path.basename(req.params.fichier); // sécurité path traversal
  const filePath = path.join(GENERATED_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: 'PDF introuvable' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
