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

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Avertissement : SUPABASE_URL ou les clés sont manquantes dans le fichier .env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = supabase;
