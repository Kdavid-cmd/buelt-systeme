/**
 * backend/services/supabaseClient.js
 * Service d'initialisation du client Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Polyfill pour WebSocket (requis par Supabase dans Electron/Node.js)
if (typeof WebSocket === 'undefined') {
  global.WebSocket = require('ws');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Supabase est optionnel : sans URL/clé (déploiement sans Supabase), on
// n'appelle pas createClient (qui lève une erreur bloquante si l'URL est
// vide) et on exporte null. Tous les appels à `supabase` dans database/db.js
// sont déjà protégés par des try/catch avec repli JSON local — un client
// null y est donc simplement traité comme "Supabase indisponible", sans
// changer le comportement lorsque Supabase est réellement configuré.
let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Avertissement : SUPABASE_URL ou les clés sont manquantes — fonctionnement en JSON local uniquement.');
} else {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

module.exports = supabase;
