/**
 * backend/routes/auth.js
 * GET  /api/auth/countries -> Récupérer la liste des pays et leurs zones
 * POST /api/auth/login     -> Vérifie le code d'accès et pose un cookie de session
 * POST /api/auth/logout    -> Efface la session
 * GET  /api/auth/me        -> Indique si la session en cours est valide
 */
const express = require('express');
const router = express.Router();
const { verifierCode } = require('../models/user');
const { PAYS_LIST } = require('../services/surtaxeService');
const { issueSessionCookie, clearSessionCookie, requireAuth } = require('../services/sessionService');
const logger = require('../services/loggerService');

// Ce routeur est monté sur /api/auth AVANT le middleware global requireAuth
// (server.js) — donc /login et /logout doivent rester publics, et /countries
// + /me doivent explicitement appliquer requireAuth eux-mêmes.

// ── Obtenir la liste des pays et zones ──────────────────────────────
router.get('/countries', requireAuth, (req, res) => {
  try {
    const sorted = [...PAYS_LIST].sort((a, b) => a.nom.localeCompare(b.nom));
    res.json({ ok: true, countries: sorted });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Login ───────────────────────────────────────────────────────────
// Un seul code d'accès commun, sans compte individuel ni rôle : il prouve
// juste "accès interne valide" et donne accès à la même interface pour tous.
router.post('/login', (req, res) => {
  try {
    const { code } = req.body;
    logger.info('POST /api/auth/login');
    const valide = verifierCode(code);
    if (valide) {
      logger.info('Connexion réussie');
      issueSessionCookie(res);
      res.json({ ok: true });
    } else {
      logger.warn('Tentative de connexion échouée');
      res.status(401).json({ ok: false, message: 'Code incorrect' });
    }
  } catch (err) {
    logger.error('Erreur authentification:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Logout ──────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ── Session courante ────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
