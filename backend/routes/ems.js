/**
 * backend/routes/ems.js
 * GET  /api/ems/zones     → zones EMS + liste des pays (référence + autocomplétion)
 * GET  /api/ems/tarifs    → grille tarifaire d'une zone EMS
 * POST /api/ems/calculer  → calcule le tarif EMS pour un pays + un poids
 */
const express = require('express');
const router = express.Router();
const { EMS_COUNTRIES, EMS_ZONE_INFO, obtenirZoneEms, trouverTrancheEms } = require('../data/emsReference');

router.get('/zones', (req, res) => {
  const zones = Object.keys(EMS_ZONE_INFO).map(num => ({
    zone: Number(num),
    countries: EMS_ZONE_INFO[num].countries,
    delay: EMS_ZONE_INFO[num].delay,
    countryCount: EMS_COUNTRIES.filter(c => c[1] === Number(num)).length
  }));
  const countriesList = [...EMS_COUNTRIES]
    .map(c => ({ nom: c[0], zone: c[1] }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  res.json({ ok: true, zones, countriesList, note: "Grille tarifaire EMS officielle intégrée au système." });
});

router.get('/tarifs', (req, res) => {
  const zone = parseInt(req.query.zone) || 1;
  const info = EMS_ZONE_INFO[zone];
  if (!info) return res.status(404).json({ ok: false, error: 'Zone EMS inconnue' });
  res.json({
    ok: true,
    zone,
    delay: info.delay,
    rates: info.rates.map(r => ({ band: r[0], ht: r[1], tva: r[2], ttc: r[3] })),
    note: "Grille tarifaire EMS officielle intégrée au système."
  });
});

// ── Calculateur EMS : pays → zone, poids → tranche, tranche → tarif ────
router.post('/calculer', (req, res) => {
  try {
    const { dest_pays, poids } = req.body || {};

    if (!dest_pays || !String(dest_pays).trim()) {
      return res.status(400).json({ ok: false, error: 'Pays de destination requis.' });
    }
    const zone = obtenirZoneEms(dest_pays);
    if (!zone) {
      return res.status(404).json({ ok: false, error: `Pays EMS non reconnu : « ${dest_pays} ». Sélectionnez un pays dans la liste (onglet Zones).` });
    }

    const w = parseFloat(poids);
    if (!w || w <= 0) {
      return res.status(400).json({ ok: false, error: 'Poids requis (kg).' });
    }

    const tranche = trouverTrancheEms(zone, w);
    if (!tranche) {
      return res.status(400).json({ ok: false, error: `Poids de ${w} kg hors grille EMS disponible (maximum 30 kg par envoi).` });
    }

    const info = EMS_ZONE_INFO[zone];
    res.json({
      ok: true,
      resultat: {
        dest_pays,
        zone,
        delay: info.delay,
        poids: w,
        band: tranche.band,
        ht: tranche.ht,
        tva: tranche.tva,
        ttc: tranche.ttc
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
