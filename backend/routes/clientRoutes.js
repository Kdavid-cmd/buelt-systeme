/**
 * backend/routes/clientRoutes.js
 * Routes publiques pour l'Espace Client Web La Poste CI (BUELT).
 * Permet l'estimation de tarif (Montant Total unique) et le pré-enregistrement avec QR Code.
 */

const express = require('express');
const router = express.Router();
const { fetchDhlLiveRate } = require('../services/dhlApiService');
const { calculerSurtaxes, PAYS_LIST, obtenirZone } = require('../services/surtaxeService');
const { insertPreRegistration, findPreRegistrationByCode } = require('../database/db');
const logger = require('../services/loggerService');

// Helper pour trouver le code ISO 2 lettres du pays
function getCountryCode(countryName) {
  const paysObj = PAYS_LIST.find(p => p.nom.toLowerCase() === (countryName || '').toLowerCase());
  return paysObj ? paysObj.code : 'FR';
}

function parseNum(val, fallback = 0) {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const str = String(val).replace(',', '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

/**
 * POST /api/client/estimate
 * Estimation tarifaire pour le client public.
 * REGLE DE CONFIDENTIALITE : Retourne UNIQUEMENT le total_payer net.
 */
router.post('/estimate', async (req, res) => {
  try {
    const { dest_pays, poids_reel, longueur, largeur, hauteur, type_envoi } = req.body;

    if (!dest_pays || !poids_reel) {
      return res.status(400).json({ error: 'Le pays de destination et le poids sont requis.' });
    }

    const countryCode = getCountryCode(dest_pays);
    const poidsNum = parseNum(poids_reel, 0.5);
    const l = parseNum(longueur, 0);
    const w = parseNum(largeur, 0);
    const h = parseNum(hauteur, 0);
    const isDoc = (type_envoi || 'DOCUMENT').toUpperCase() === 'DOCUMENT';

    // Poids volumétrique (L x l x h / 5000)
    const poids_vol = (l && w && h) ? (l * w * h) / 5000 : 0;
    const poids_fact = Math.max(poidsNum, poids_vol);

    // Interrogation de l'API DHL Live / Simulated pour obtenir le montant_jour_dhl
    const dhlRateResult = await fetchDhlLiveRate({
      destCountryCode: countryCode,
      weight: poids_fact,
      isDoc,
      dimensions: { l, w, h }
    });

    // Calcul officiel La Poste CI (Guichet + Surtaxe)
    const calcul = calculerSurtaxes({
      dest_pays,
      poids_reel: poidsNum,
      longueur: l,
      largeur: w,
      hauteur: h,
      type_envoi: isDoc ? 'DOCUMENT' : 'COLIS',
      montant_jour_dhl: dhlRateResult.montant_jour_dhl
    });

    // Réponse client masquant les détails internes
    res.json({
      ok: true,
      dest_pays,
      type_envoi: calcul.type_envoi,
      poids_fact: calcul.poids_fact,
      total_payer: calcul.total_payer
    });
  } catch (err) {
    logger.error('Erreur /api/client/estimate:', err);
    res.status(500).json({ error: 'Impossible de calculer le tarif pour le moment.' });
  }
});

/**
 * POST /api/client/pre-register
 * Pré-enregistrement de l'envoi par le client.
 * Enregistre les détails (y compris les détails internes pour le guichetier)
 * et génère le code unique PRE-DHL-XXXXXX.
 */
router.post('/pre-register', async (req, res) => {
  try {
    const {
      exp_nom, exp_tel, exp_email, exp_adresse,
      dest_nom, dest_tel, dest_adresse, dest_pays, dest_ville,
      poids_reel, longueur, largeur, hauteur, type_envoi,
      valeur_declaree
    } = req.body;

    if (!exp_nom || !exp_tel || !dest_nom || !dest_tel || !dest_pays || !poids_reel) {
      return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires (expéditeur, destinataire, pays, poids).' });
    }

    const countryCode = getCountryCode(dest_pays);
    const poidsNum = parseNum(poids_reel, 0.5);
    const l = parseNum(longueur, 0);
    const w = parseNum(largeur, 0);
    const h = parseNum(hauteur, 0);
    const isDoc = (type_envoi || 'DOCUMENT').toUpperCase() === 'DOCUMENT';

    const poids_vol = (l && w && h) ? (l * w * h) / 5000 : 0;
    const poids_fact = Math.max(poidsNum, poids_vol);

    // Cotation DHL Live / Simulated
    const dhlRateResult = await fetchDhlLiveRate({
      destCountryCode: countryCode,
      weight: poids_fact,
      isDoc,
      dimensions: { l, w, h }
    });

    // Calcul officiel complet pour le guichetier
    const calcul = calculerSurtaxes({
      dest_pays,
      poids_reel: poidsNum,
      longueur: l,
      largeur: w,
      hauteur: h,
      type_envoi: isDoc ? 'DOCUMENT' : 'COLIS',
      montant_jour_dhl: dhlRateResult.montant_jour_dhl
    });

    // Génération du code unique à 6 chiffres
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const code = `PRE-DHL-${randomSuffix}`;

    const preRegRecord = await insertPreRegistration({
      code,
      exp_nom,
      exp_tel,
      exp_email: exp_email || '',
      exp_adresse: exp_adresse || '',
      dest_nom,
      dest_tel,
      dest_adresse: dest_adresse || '',
      dest_ville: dest_ville || '',
      dest_pays,
      type_envoi: calcul.type_envoi,
      valeur_declaree: valeur_declaree || '—',
      poids_reel: calcul.poids_reel,
      poids_vol: calcul.poids_vol,
      poids_fact: calcul.poids_fact,
      zone: calcul.zone,
      total_payer: calcul.total_payer,
      // Données réservées à l'interne pour le guichetier
      montant_jour_dhl: calcul.montant_jour_dhl,
      tarif_guichet: calcul.tarif_guichet,
      tarif_poste: calcul.tarif_poste,
      surtaxe: calcul.surtaxe,
      breakdown: dhlRateResult.breakdown
    });

    logger.info(`Pré-enregistrement créé : ${code} pour ${exp_nom} -> ${dest_nom} (${dest_pays})`);

    // Réponse client (seul le total est transmis)
    res.json({
      ok: true,
      code: preRegRecord.code,
      total_payer: preRegRecord.total_payer,
      dest_pays: preRegRecord.dest_pays,
      type_envoi: preRegRecord.type_envoi,
      created_at: preRegRecord.created_at
    });

  } catch (err) {
    logger.error('Erreur /api/client/pre-register:', err);
    res.status(500).json({ error: 'Impossible de créer le pré-enregistrement.' });
  }
});

/**
 * GET /api/client/pre-register/:code
 * Consultation du pré-enregistrement par son code.
 */
router.get('/pre-register/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const record = await findPreRegistrationByCode(code);

    if (!record) {
      return res.status(404).json({ error: 'Pré-enregistrement introuvable.' });
    }

    // Si la requête provient d'un agent authentifié (session cookie présente)
    const isAgentSession = !!(req.cookies && req.cookies.buelt_session);

    if (isAgentSession) {
      // Retourne l'intégralité des données internes pour l'agent guichetier
      return res.json({ ok: true, preRegistration: record, isAgent: true });
    }

    // Sinon, récapitulatif grand public masquant les secrets commerciaux
    res.json({
      ok: true,
      preRegistration: {
        code: record.code,
        exp_nom: record.exp_nom,
        dest_nom: record.dest_nom,
        dest_pays: record.dest_pays,
        type_envoi: record.type_envoi,
        poids_fact: record.poids_fact,
        total_payer: record.total_payer,
        status: record.status,
        created_at: record.created_at
      },
      isAgent: false
    });
  } catch (err) {
    logger.error('Erreur /api/client/pre-register/:code:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du pré-enregistrement.' });
  }
});

module.exports = router;
