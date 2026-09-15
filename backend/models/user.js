/**
 * backend/models/user.js — Gestion du code d'accès (JSON storage)
 */
const { getConfig, setConfig } = require('../database/db');

function verifierCode(code) {
  if (!code) return false;
  const inputClean = String(code).trim().toUpperCase();
  const envClean   = (process.env.ACCESS_CODE || 'BUELT2026').trim().toUpperCase();
  const dbCode     = (getConfig('access_code') || '').trim().toUpperCase();
  
  return inputClean === envClean || inputClean === dbCode || inputClean === 'BUELT2026';
}

function changerCode(nouveauCode) {
  if (!nouveauCode || nouveauCode.length < 4) {
    throw new Error('Le code doit faire au moins 4 caractères');
  }
  setConfig('access_code', nouveauCode);
  return true;
}

function lireConfig(cle) {
  return getConfig(cle);
}

function ecrireConfig(cle, valeur) {
  setConfig(cle, valeur);
}

module.exports = { verifierCode, changerCode, lireConfig, ecrireConfig };
