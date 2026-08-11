/**
 * backend/database/db.js
 * Gestion de la base de données Hybride : Supabase Cloud + Fallback JSON Local
 * Assure le fonctionnement hors-ligne tout en synchronisant les reçus vers Supabase.
 */

const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const supabase = require('../services/supabaseClient');

const DB_DIR = (global.APP_PATHS && global.APP_PATHS.DATABASE_DIR) || path.resolve(path.join(__dirname, '..', '..', 'database'));

const FILES = {
  calculs: path.join(DB_DIR, 'calculs.json'),
  config:  path.join(DB_DIR, 'config.json')
};

function initDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  if (!fs.existsSync(FILES.calculs)) {
    _write(FILES.calculs, { nextId: 1, rows: [] });
  }

  if (!fs.existsSync(FILES.config)) {
    _write(FILES.config, {
      access_code:       process.env.ACCESS_CODE || 'BUELT2026',
      taux_carburant:    '24',
      taux_urgence:      '55',
      taux_zone_eloignee:'80',
      taux_livraison_sam:'35'
    });
  }

  console.log(`[DB Hybride] Initialisé (Supabase Cloud + Secours JSON local : ${DB_DIR})`);
}

function _read(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function _write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── Config ────────────────────────────────────────────
function getConfig(cle) {
  const cfg = _read(FILES.config);
  return cfg[cle] !== undefined ? String(cfg[cle]) : null;
}

function setConfig(cle, valeur) {
  const cfg = _read(FILES.config);
  cfg[cle] = valeur;
  _write(FILES.config, cfg);
}

// ── Générateur séquentiel de numéro de reçu (Ex: REC-COC-2026-0001) ──
async function genererNumeroRecu(bureau = 'COCODY') {
  const codeAgence = (bureau || 'COCODY').toUpperCase();
  const annee = new Date().getFullYear();
  
  try {
    const { data, error } = await supabase.rpc('get_next_receipt_number', { agence_code: codeAgence });
    if (!error && data) {
      return `REC-${codeAgence}-${annee}-${String(data).padStart(4, '0')}`;
    }
  } catch (err) {
    // fallback local
  }

  const store = _read(FILES.calculs);
  const count = (store.rows || []).length + 1;
  return `REC-${codeAgence}-${annee}-${String(count).padStart(4, '0')}`;
}

// ── Calculs CRUD (Supabase + Local) ───────────────────

async function insertCalcul(data) {
  // 1. Sauvegarder en local JSON (toujours pour vitesse & secours)
  const store = _read(FILES.calculs);
  const id = store.nextId;
  const localRow = {
    id,
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ...data
  };
  store.rows.unshift(localRow);
  store.nextId = id + 1;
  _write(FILES.calculs, store);

  // 2. Synchroniser vers Supabase
  try {
    const payloadSupabase = {
      receipt_number: data.numero_recu || `REC-COC-${new Date().getFullYear()}-${id}`,
      waybill: data.waybill || '000000',
      bureau_poste: data.bureau_poste || 'COCODY',
      exp_nom: data.exp_nom || '',
      exp_tel: data.exp_tel || '',
      exp_adresse: data.exp_adresse || '',
      dest_nom: data.dest_nom || '',
      dest_tel: data.dest_tel || '',
      dest_adresse: data.dest_adresse || '',
      dest_pays: data.dest_pays || 'France',
      type_envoi: data.type_envoi || 'DOCUMENT',
      valeur_declaree: data.valeur_declaree || '—',
      poids_reel: parseFloat(data.poids_reel) || 0,
      poids_vol: parseFloat(data.poids_vol) || 0,
      poids_fact: parseFloat(data.poids_fact) || 0,
      zone: parseInt(data.zone) || 4,
      tarif_guichet: parseFloat(data.tarif_guichet) || 0,
      tarif_poste: parseFloat(data.tarif_poste) || 0,
      montant_jour_dhl: parseFloat(data.montant_jour_dhl) || 0,
      surtaxe: parseFloat(data.surtaxe) || 0,
      total_payer: parseFloat(data.total_payer) || 0,
      agent_nom: data.agent_nom || 'Agent'
    };

    const { data: inserted, error } = await supabase.from('recus').insert([payloadSupabase]).select().single();
    if (error) {
      console.warn('[Supabase Sync Warn] Enregistré en local uniquement:', error.message);
    } else if (inserted) {
      console.log('[Supabase Sync Success] Reçu synchronisé avec ID Cloud:', inserted.id);
      localRow.supabase_id = inserted.id;
      _write(FILES.calculs, store);
    }
  } catch (err) {
    console.warn('[Supabase Sync Error] Supabase non joignable, conservé en local.');
  }

  return localRow;
}

async function listCalculs({ limit = 50, offset = 0 } = {}) {
  try {
    const { data, error } = await supabase
      .from('recus')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error && data && data.length > 0) {
      return data.map(r => ({
        id: r.id,
        created_at: r.created_at,
        ...r
      }));
    }
  } catch (err) {
    // Fallback JSON local
  }

  const store = _read(FILES.calculs);
  return (store.rows || []).slice(offset, offset + limit);
}

async function findCalcul(id) {
  try {
    if (typeof id === 'string' && id.length > 10) {
      const { data } = await supabase.from('recus').select('*').eq('id', id).single();
      if (data) return data;
    }
  } catch (err) {}

  const store = _read(FILES.calculs);
  return (store.rows || []).find(r => r.id === Number(id) || r.id === id || r.supabase_id === id) || null;
}

async function updateCalcul(id, data) {
  const store = _read(FILES.calculs);
  const index = (store.rows || []).findIndex(r => r.id === Number(id) || r.id === id || r.supabase_id === id);
  let updatedRow = null;

  if (index !== -1) {
    updatedRow = {
      ...store.rows[index],
      ...data,
      updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    store.rows[index] = updatedRow;
    _write(FILES.calculs, store);
  }

  try {
    const supabaseId = updatedRow?.supabase_id || id;
    if (typeof supabaseId === 'string' && supabaseId.length > 10) {
      await supabase.from('recus').update({
        waybill: data.waybill,
        exp_nom: data.exp_nom,
        exp_tel: data.exp_tel,
        exp_adresse: data.exp_adresse,
        dest_nom: data.dest_nom,
        dest_tel: data.dest_tel,
        dest_adresse: data.dest_adresse,
        dest_pays: data.dest_pays,
        poids_reel: data.poids_reel,
        poids_vol: data.poids_vol,
        poids_fact: data.poids_fact,
        type_envoi: data.type_envoi,
        tarif_guichet: data.tarif_guichet,
        tarif_poste: data.tarif_poste,
        montant_jour_dhl: data.montant_jour_dhl,
        surtaxe: data.surtaxe,
        total_payer: data.total_payer,
        agent_nom: data.agent_nom
      }).eq('id', supabaseId);
    }
  } catch (err) {
    console.warn('[Supabase Update Fail] Mis à jour en local uniquement');
  }

  return updatedRow;
}

async function deleteCalcul(id) {
  const store = _read(FILES.calculs);
  const item = (store.rows || []).find(r => r.id === Number(id) || r.id === id || r.supabase_id === id);
  store.rows = (store.rows || []).filter(r => r.id !== Number(id) && r.id !== id && r.supabase_id !== id);
  _write(FILES.calculs, store);

  try {
    const supabaseId = item?.supabase_id || id;
    if (typeof supabaseId === 'string' && supabaseId.length > 10) {
      await supabase.from('recus').delete().eq('id', supabaseId);
    }
  } catch (err) {}
}

async function countCalculs() {
  try {
    const { count, error } = await supabase.from('recus').select('*', { count: 'exact', head: true });
    if (!error && count !== null) return count;
  } catch (err) {}

  const store = _read(FILES.calculs);
  return (store.rows || []).length;
}

module.exports = {
  initDb,
  getConfig,
  setConfig,
  genererNumeroRecu,
  insertCalcul,
  updateCalcul,
  listCalculs,
  findCalcul,
  deleteCalcul,
  countCalculs
};
