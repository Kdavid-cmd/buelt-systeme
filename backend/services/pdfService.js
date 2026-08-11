/**
 * backend/services/pdfService.js
 * Génération de reçus PDF côté backend (Node.js)
 * Utilise jsPDF (version CommonJS/Node)
 */
const path = require('path');
const fs = require('fs');

// Dossier de sortie
const GENERATED_DIR = (global.APP_PATHS && global.APP_PATHS.GENERATED_DIR) || path.resolve(path.join(__dirname, '..', '..', 'generated'));
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

/**
 * Formater un montant en FCFA
 */
function fmt(val) {
  const n = Math.round(Number(val) || 0);
  const sign = n < 0 ? '-' : '';
  // Séparateur de milliers = espace ASCII normal (0x20), pas l'espace fine
  // insécable (U+202F) de toLocaleString('fr-FR') — non supporté par la
  // police Helvetica intégrée de jsPDF (s'affichait comme un caractère "/").
  const withSpaces = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${withSpaces} FCFA`;
}

/**
 * Formater une date courte
 */
function fmtDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Générer le PDF d'un reçu de surtaxe DHL
 * @param {object} data — données du calcul
 * @returns {string} chemin absolu du PDF généré
 */
async function genererPdfRecu(data) {
  const identifiant = data.numero_recu || data.waybill;
  if (!identifiant || String(identifiant).trim() === '' || String(identifiant).trim().toLowerCase() === 'undefined') {
    throw new Error("Impossible de générer le reçu : aucun numéro de reçu ni waybill valide n'a été fourni.");
  }

  const { jsPDF } = require('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const VERT  = [1, 96, 74];
  const JAUNE = [254, 219, 3];
  const NOIR  = [26, 31, 43];
  const GRIS  = [91, 100, 114];
  const BGVERT = [230, 244, 238];
  const PAGE_W = 210;
  const MARG   = 20;
  const CONT_W = PAGE_W - MARG * 2;

  let y = 0;

  // ── En-tête vert ────────────────────────────────────────────────────
  doc.setFillColor(...VERT);
  doc.rect(0, 0, PAGE_W, 32, 'F');

  // Ajout du logo sur la GAUCHE dans le PDF
  const logoPath = path.join(__dirname, '..', '..', 'frontend', 'static', 'img', 'laposte-logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      const logoBase64 = logoBuffer.toString('base64');
      doc.addImage(logoBase64, 'PNG', MARG, 6, 28, 20); // Logo aligné à GAUCHE (x = MARG)
      
      // Texte décalé vers la droite pour laisser place au logo
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('POST EXPRESS PREMIUM', MARG + 34, 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(190, 233, 214);
      doc.text('La Poste Côte d\'Ivoire · BUELT', MARG + 34, 20);
    } catch {
      // Fallback si erreur addImage
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('POST EXPRESS PREMIUM', MARG, 13);
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('POST EXPRESS PREMIUM', MARG, 13);
  }

  // Badge jaune (déplacé un peu si nécessaire, mais reste à droite)
  doc.setFillColor(...JAUNE);
  doc.roundedRect(PAGE_W - MARG - 48, 10, 48, 12, 3, 3, 'F');
  doc.setTextColor(...NOIR);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('REÇU SURTAXE DHL', PAGE_W - MARG - 48 + 24, 17.5, { align: 'center' });

  y = 40;

  // ── Bande jaune sous le header ───────────────────────────────────────
  doc.setFillColor(...JAUNE);
  doc.rect(MARG, y, CONT_W, 1, 'F');
  y += 4;

  // ── Infos reçu ──────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.setFont('helvetica', 'normal');
  doc.text(`Numéro de suivi (Waybill) : ${data.waybill || '—'}`, MARG, y + 4);
  doc.text(`Date : ${fmtDate(data.created_at || data.date)}`, PAGE_W / 2 - 10, y + 4);
  doc.text(`Bureau : ${data.bureau_poste || 'COCODY'} / Agent : ${data.agent_nom || '—'}`, PAGE_W - MARG, y + 4, { align: 'right' });
  y += 14;

  // ── Fonction helper : section ────────────────────────────────────────
  function section(titre) {
    doc.setFillColor(...VERT);
    doc.rect(MARG, y, CONT_W, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(titre.toUpperCase(), MARG + 3, y + 4);
    y += 9;
    doc.setTextColor(...NOIR);
    doc.setFont('helvetica', 'normal');
  }

  function ligne(label, valeur, gras = false) {
    const yCur = y;
    if ((Math.floor((yCur - 60) / 7) % 2 === 0)) {
      doc.setFillColor(248, 250, 253);
      doc.rect(MARG, yCur - 1, CONT_W, 7, 'F');
    }
    doc.setTextColor(...GRIS);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, MARG + 2, yCur + 4);

    doc.setTextColor(...NOIR);
    if (gras) { doc.setFont('helvetica', 'bold'); doc.setTextColor(...VERT); }
    doc.text(valeur, PAGE_W - MARG - 2, yCur + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...NOIR);

    doc.setDrawColor(217, 222, 232);
    doc.line(MARG, yCur + 6, PAGE_W - MARG, yCur + 6);
    y += 7;
  }

  // ── Section Expéditeur ──────────────────────────────────────────────
  section('Expéditeur');
  ligne('Nom et Prénom', data.exp_nom || '—');
  ligne('Adresse', data.exp_adresse || '—');
  ligne('Téléphone', data.exp_tel || '—');
  y += 3;

  // ── Section Destinataire ────────────────────────────────────────────
  section('Destinataire');
  ligne('Nom et Prénom', data.dest_nom || '—');
  ligne('Adresse', data.dest_adresse || '—');
  ligne('Téléphone', data.dest_tel || '—');
  ligne('Pays de destination', `${data.dest_pays || '—'} (Zone ${data.zone || '—'})`);
  y += 3;

  // ── Section Colis ───────────────────────────────────────────────────
  section('Détails de la facturation');
  ligne('Nature', `${data.type_envoi || 'DOCUMENT'} — ${data.dest_pays || '—'} (Zone ${data.zone || '—'})`);
  ligne('Poids réel', `${data.poids_reel || 0} kg`);
  ligne('Poids volumétrique', `${data.poids_vol || 0} kg`);
  ligne('Poids payable', `${data.poids_fact || 0} kg`, true);
  ligne('Valeur déclarée', data.valeur_declaree || '—');
  y += 3;

  // ── Section Tarifs ──────────────────────────────────────────────────
  section('Détails financiers');
  ligne('Tarif Guichet', fmt(data.tarif_guichet));
  ligne('Surtaxe (carburant, éloignement ou risque pays)', fmt(data.surtaxe), true);
  y += 3;

  // ── Total ────────────────────────────────────────────────────────────
  y += 2;
  doc.setFillColor(...BGVERT);
  doc.roundedRect(MARG, y, CONT_W, 14, 2, 2, 'F');
  doc.setDrawColor(...VERT);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARG, y, CONT_W, 14, 2, 2, 'S');

  doc.setTextColor(...VERT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Montant total à payer', MARG + 4, y + 9);
  doc.setFontSize(14);
  doc.text(fmt(data.total_payer), PAGE_W - MARG - 4, y + 9, { align: 'right' });
  y += 20;

  // ── Signatures ──────────────────────────────────────────────────────
  doc.setDrawColor(...GRIS);
  doc.setLineWidth(0.3);
  const sigW = (CONT_W - 10) / 2;
  
  doc.line(MARG, y + 20, MARG + sigW, y + 20);
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature de l\'Agent', MARG + sigW / 2, y + 25, { align: 'center' });
  
  doc.line(MARG + sigW + 10, y + 20, PAGE_W - MARG, y + 20);
  doc.text('Signature du Client', MARG + sigW + 10 + sigW / 2, y + 25, { align: 'center' });
  y += 35;

  // ── Pied de page ────────────────────────────────────────────────────
  doc.setFillColor(...VERT);
  doc.rect(0, 285, PAGE_W, 12, 'F');
  doc.setTextColor(190, 233, 214);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'BUELT — La Poste CI · Reçu généré localement, sans transmission de données.',
    PAGE_W / 2, 291, { align: 'center' }
  );
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Post Express Premium · Calcul de surtaxe · Généré le ${fmtDate(data.created_at || data.date)}`,
    PAGE_W / 2, 295, { align: 'center' }
  );

  const dateObj = data.created_at ? new Date(data.created_at) : (data.date ? new Date(data.date) : new Date());
  const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  const pdfPath = path.join(GENERATED_DIR, `recu_${identifiant}_${dateStr}.pdf`);
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(pdfPath, pdfBuffer);

  return pdfPath;
}

module.exports = { genererPdfRecu };
