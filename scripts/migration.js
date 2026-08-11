/**
 * scripts/migration.js
 * Migre les reçus existants depuis calculs.json vers Supabase.
 * Exécuter une seule fois : node scripts/migration.js
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const JSON_PATH = path.join(__dirname, '..', 'database', 'calculs.json');

async function migrer() {
  console.log('\n🚀 Début de la migration vers Supabase...\n');

  if (!fs.existsSync(JSON_PATH)) {
    console.log('❌ Aucun fichier calculs.json trouvé à migrer.');
    return;
  }

  const store = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const rows = store.rows || [];

  if (rows.length === 0) {
    console.log('📭 Aucun reçu à migrer (fichier JSON vide).');
    return;
  }

  console.log(`📦 ${rows.length} reçus trouvés dans calculs.json...\n`);

  let migres = 0;
  let erreurs = 0;
  const bureaux = new Set();

  for (const row of rows) {
    const bureau = (row.bureau_poste || 'COCODY').toUpperCase();
    bureaux.add(bureau);
    const annee = row.created_at ? row.created_at.substring(0, 4) : new Date().getFullYear();
    const numSeq = String(row.id || migres + 1).padStart(4, '0');

    const payload = {
      receipt_number: row.numero_recu || `REC-${bureau}-${annee}-${numSeq}`,
      waybill: row.waybill || '000000',
      bureau_poste: bureau,
      exp_nom: row.exp_nom || '',
      exp_tel: row.exp_tel || '',
      exp_adresse: row.exp_adresse || '',
      dest_nom: row.dest_nom || '',
      dest_tel: row.dest_tel || '',
      dest_adresse: row.dest_adresse || '',
      dest_pays: row.dest_pays || 'France',
      type_envoi: row.type_envoi || 'DOCUMENT',
      valeur_declaree: row.valeur_declaree || '—',
      poids_reel: parseFloat(row.poids_reel) || 0,
      poids_vol: parseFloat(row.poids_vol) || 0,
      poids_fact: parseFloat(row.poids_fact) || 0,
      zone: parseInt(row.zone) || 4,
      tarif_guichet: parseFloat(row.tarif_guichet) || 0,
      tarif_poste: parseFloat(row.tarif_poste) || 0,
      montant_jour_dhl: parseFloat(row.montant_jour_dhl) || 0,
      surtaxe: parseFloat(row.surtaxe) || 0,
      total_payer: parseFloat(row.total_payer) || 0,
      agent_nom: row.agent_nom || 'Agent',
      date_emission: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };

    const { error } = await supabase.from('recus').upsert([payload], { onConflict: 'receipt_number' });

    if (error) {
      console.error(`  ❌ Erreur sur reçu ${payload.receipt_number}: ${error.message}`);
      erreurs++;
    } else {
      console.log(`  ✅ ${payload.receipt_number} — ${payload.dest_pays} — ${payload.total_payer.toLocaleString('fr-FR')} FCFA`);
      migres++;
    }
  }

  // Initialiser les compteurs par bureau
  for (const bureau of bureaux) {
    const { error } = await supabase.from('compteur_recus').upsert(
      [{ code_agence: bureau, dernier_numero: rows.filter(r => (r.bureau_poste || 'COCODY').toUpperCase() === bureau).length }],
      { onConflict: 'code_agence' }
    );
    if (!error) console.log(`\n  🔢 Compteur initialisé pour ${bureau}`);
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`✅ Migration terminée !`);
  console.log(`   Succès : ${migres} reçu(s)`);
  console.log(`   Erreurs : ${erreurs}`);
  console.log(`══════════════════════════════════════\n`);
}

migrer().catch(console.error);
