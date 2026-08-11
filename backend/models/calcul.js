/**
 * backend/models/calcul.js — CRUD pour les calculs (Supabase + JSON fallback)
 * Toutes les fonctions sont désormais async.
 */
const { insertCalcul, updateCalcul, listCalculs, findCalcul, deleteCalcul, countCalculs } = require('../database/db');

async function sauvegarderCalcul(data) {
  return await insertCalcul(data);
}

async function mettreAjourCalcul(id, data) {
  return await updateCalcul(id, data);
}

async function listerCalculs(opts) {
  return await listCalculs(opts);
}

async function trouverCalcul(id) {
  return await findCalcul(id);
}

async function supprimerCalcul(id) {
  return await deleteCalcul(id);
}

async function compterCalculs() {
  return await countCalculs();
}

module.exports = { sauvegarderCalcul, mettreAjourCalcul, listerCalculs, trouverCalcul, supprimerCalcul, compterCalculs };
