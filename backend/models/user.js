/**
 * backend/models/user.js — Gestion du code d'accès (JSON storage)
 */
const { getConfig, setConfig } = require('../database/db');

function verifierCode(code) {
  const codeStocke = getConfig('access_code') || (process.env.ACCESS_CODE || 'BUELT2026');
  return code === codeStocke;
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
