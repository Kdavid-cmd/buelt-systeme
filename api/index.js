/**
 * api/index.js — Vercel Serverless Function entrypoint
 * Exporte le handler Express compatible avec les fonctions serverless Vercel.
 */
const { app } = require('../backend/server');

// Vercel Serverless Functions expects a function(req, res)
module.exports = (req, res) => app(req, res);

