/**
 * backend/routes/calculs.js
 * POST /api/calculs/calculer  → calcule les surtaxes (sans sauvegarder)
 * POST /api/calculs/sauvegarder → calcule ET sauvegarde
 * GET  /api/calculs/historique  → liste des calculs
 * GET  /api/calculs/:id         → un calcul
 * PUT  /api/calculs/:id         → modifier
 * DELETE /api/calculs/:id       → supprimer
 */
const express = require('express');
const router = express.Router();
const { calculerSurtaxes } = require('../services/surtaxeService');
const { genererNumeroRecu } = require('../database/db');
const { sauvegarderCalcul, mettreAjourCalcul, listerCalculs, trouverCalcul, supprimerCalcul, compterCalculs } = require('../models/calcul');
const logger = require('../services/loggerService');

// ── Calculer (sans sauvegarder) ─────────────────────────────────────
router.post('/calculer', (req, res) => {
  try {
    const params = req.body;
    const resultat = calculerSurtaxes(params);
    res.json({ ok: true, resultat });
  } catch (err) {
    logger.error('Erreur calcul:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Calculer ET sauvegarde ──────────────────────────────────────────
router.post('/sauvegarder', async (req, res) => {
  try {
    const params = req.body;
    const resultat = calculerSurtaxes(params);
    const bureau = params.bureau_poste || 'COCODY';
    const numero_recu = params.waybill || await genererNumeroRecu(bureau);

    const enregistrement = await sauvegarderCalcul({
      waybill:       params.waybill || '',
      // Expéditeur
      exp_nom:       params.exp_nom,
      exp_tel:       params.exp_tel,
      exp_adresse:   params.exp_adresse || '',
      // Destinataire
      dest_nom:      params.dest_nom,
      dest_tel:      params.dest_tel,
      dest_adresse:  params.dest_adresse || '',
      dest_pays:     params.dest_pays,
      // Colis
      poids_reel:    resultat.poids_reel,
      poids_vol:     resultat.poids_vol,
      poids_fact:    resultat.poids_fact,
      zone:          resultat.zone,
      longueur:      params.longueur || 0,
      largeur:       params.largeur  || 0,
      hauteur:       params.hauteur  || 0,
      valeur_declaree: params.valeur_declaree || '—',
      // Service
      service:       params.service || 'EXPRESS',
      type_envoi:    resultat.type_envoi || params.type_envoi || 'DOCUMENT',
      // Tarifs & Surtaxes
      tarif_guichet:    resultat.tarif_guichet,
      tarif_poste:      resultat.tarif_poste,
      montant_jour_dhl: resultat.montant_jour_dhl,
      surtaxe:          resultat.surtaxe,
      total_payer:      resultat.total_payer,
      // Bureau & Agent
      bureau_poste:  bureau,
      agent_nom:     params.agent_nom,
      numero_recu
    });

    logger.info(`Calcul sauvegardé — Waybill: ${params.waybill} / N° ${numero_recu}`);
    res.json({ ok: true, resultat: { ...resultat, ...enregistrement, numero_recu } });
  } catch (err) {
    logger.error('Erreur sauvegarde calcul:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Historique ──────────────────────────────────────────────────────
router.get('/historique', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '50'), 200);
    const offset = parseInt(req.query.offset || '0');
    const calculs = await listerCalculs({ limit, offset });
    const total   = await compterCalculs();
    res.json({ ok: true, calculs, total });
  } catch (err) {
    logger.error('Erreur historique:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Un calcul ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const calcul = await trouverCalcul(parseInt(req.params.id));
    if (!calcul) return res.status(404).json({ ok: false, error: 'Calcul introuvable' });
    res.json({ ok: true, calcul });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Modifier ────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const params = req.body;
    const resultat = calculerSurtaxes(params);

    const updatedData = {
      waybill:       params.waybill || '',
      exp_nom:       params.exp_nom,
      exp_tel:       params.exp_tel,
      exp_adresse:   params.exp_adresse || '',
      dest_nom:      params.dest_nom,
      dest_tel:      params.dest_tel,
      dest_adresse:  params.dest_adresse || '',
      dest_pays:     params.dest_pays,
      poids_reel:    resultat.poids_reel,
      poids_vol:     resultat.poids_vol,
      poids_fact:    resultat.poids_fact,
      zone:          resultat.zone,
      longueur:      params.longueur || 0,
      largeur:       params.largeur  || 0,
      hauteur:       params.hauteur  || 0,
      valeur_declaree: params.valeur_declaree || '—',
      service:       params.service || 'EXPRESS',
      type_envoi:    resultat.type_envoi || params.type_envoi || 'DOCUMENT',
      tarif_guichet:    resultat.tarif_guichet,
      tarif_poste:      resultat.tarif_poste,
      montant_jour_dhl: resultat.montant_jour_dhl,
      surtaxe:          resultat.surtaxe,
      total_payer:      resultat.total_payer,
      bureau_poste:  params.bureau_poste || 'COCODY',
      agent_nom:     params.agent_nom
    };

    const updated = await mettreAjourCalcul(id, updatedData);
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Calcul introuvable' });
    }

    logger.info(`Calcul modifié — ID: ${id} / Waybill: ${params.waybill}`);
    res.json({ ok: true, resultat: { ...resultat, ...updated } });
  } catch (err) {
    logger.error('Erreur modification calcul:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Supprimer ───────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await supprimerCalcul(id);
    logger.info(`Calcul supprimé — ID: ${id}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Erreur suppression calcul:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
