/**
 * backend/server.js — Serveur Express principal
 * Sert à la fois l'API REST et le frontend web (Système BUELT).
 */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initDb } = require('./database/db');
const { requireAuth } = require('./services/sessionService');
const authRoutes = require('./routes/auth');
const calculsRoutes = require('./routes/calculs');
const pdfRoutes = require('./routes/pdf');
const emsRoutes = require('./routes/ems');
const dhlRoutes = require('./routes/dhl');
const assistantRoutes = require('./routes/assistant');
const importRoutes = require('./routes/import');
const logger = require('./services/loggerService');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Log des requêtes ───────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ── Santé (publique, avant l'authentification) ──
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Authentification (login/logout publics, le reste du routeur est protégé plus bas) ──
app.use('/api/auth', authRoutes);

// ── Toutes les autres routes /api/* exigent une session valide ──
// Un seul niveau d'accès : le cookie de session prouve juste "code d'accès
// valide" (agent ou admin) — il n'y a plus de distinction de rôle côté produit.
app.use('/api', requireAuth);
app.use('/api/calculs', calculsRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/ems', emsRoutes);
app.use('/api/dhl', dhlRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/import', importRoutes);

// ── Frontend statique ───────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Gestion d'erreurs ──────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Erreur serveur:', err);
  res.status(500).json({ error: err.message || 'Erreur interne' });
});

// ── Démarrage ──────────────────────────────────
function start() {
  initDb();
  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(PORT, host, () => {
    logger.info(`Backend Express démarré sur http://${host}:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Le port ${PORT} est déjà utilisé. Impossible de démarrer le serveur local.`);
    } else {
      logger.error(`Erreur serveur: ${err.message}`);
    }
  });

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
