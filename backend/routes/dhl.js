/**
 * backend/routes/dhl.js
 * GET /api/dhl/tarifs?type=doc|colis&tarif=guichet|poste
 * Expose en lecture seule les grilles tarifaires réelles de surtaxeService.js
 * (utilisées pour l'onglet "Grille tarifaire" du module DHL côté frontend).
 */
const express = require('express');
const router = express.Router();
const { GUICHET_DOC_2KG, GUICHET_COLIS, POSTE_DOC_2KG, POSTE_COLIS } = require('../services/surtaxeService');

router.get('/tarifs', (req, res) => {
  const type = req.query.type === 'doc' ? 'doc' : 'colis';
  const tarif = req.query.tarif === 'poste' ? 'poste' : 'guichet';

  let grille;
  if (type === 'doc') grille = tarif === 'poste' ? POSTE_DOC_2KG : GUICHET_DOC_2KG;
  else grille = tarif === 'poste' ? POSTE_COLIS : GUICHET_COLIS;

  const rows = Object.keys(grille)
    .map(Number)
    .sort((a, b) => a - b)
    .map(poids => {
      const vals = grille[poids];
      return { poids, zones: vals.slice(1) }; // index 0 inutilisé dans la grille source
    });

  res.json({ ok: true, type, tarif, rows });
});

module.exports = router;
