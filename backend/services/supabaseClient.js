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

// Nettoie les valeurs collées dans le dashboard Vercel (espaces, guillemets).
function clean(v) {
  return (v || '').trim().replace(/^['"]|['"]$/g, '').trim();
}

const supabaseUrl = clean(process.env.SUPABASE_URL);
const supabaseKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

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
  // Une URL invalide ferait planter tout le serveur au chargement
  // (FUNCTION_INVOCATION_FAILED sur Vercel) : on bascule en JSON local.
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } catch (err) {
    console.error('❌ Supabase non initialisé (vérifiez SUPABASE_URL) :', err.message);
  }
}

module.exports = supabase;
