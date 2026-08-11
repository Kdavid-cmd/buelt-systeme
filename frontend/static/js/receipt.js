/**
 * frontend/static/js/receipt.js
 * Construction et affichage de l'aperçu reçu HTML — structure et champs
 * identiques au reçu validé (backend/services/pdfService.js).
 */

function fmtFcfa(val) {
  return Number(val || 0).toLocaleString('fr-FR') + ' FCFA';
}

function fmtDateTime(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function buildReceiptHtml(r) {
  const date = fmtDateTime(r.created_at || r.date);
  const zoneStr = r.zone ? `(Zone ${r.zone})` : '';

  function rl(label, value, strong) {
    return `<div class="receipt-line${strong ? ' strong' : ''}"><span class="rl">${label}</span><span class="rv">${value}</span></div>`;
  }
  function section(titre) {
    return `<div class="receipt-section">${titre}</div>`;
  }

  let html = `<div class="receipt-card">
    <div class="receipt-header">
      <img src="static/img/laposte-logo.png" alt="La Poste CI">
      <div class="receipt-header-text">
        <h2>POST EXPRESS PREMIUM</h2>
        <p class="sub">Reçu d'envoi · La Poste CI BUELT</p>
      </div>
    </div>
    <div class="receipt-body">
      <div class="receipt-meta">
        <span><strong>N° Suivi (Waybill) :</strong> ${r.waybill || '—'}</span>
        <span><strong>Date :</strong> ${date}</span>
        <span><strong>Bureau :</strong> ${r.bureau_poste || 'COCODY'}</span>
        <span><strong>Agent :</strong> ${r.agent_nom || '—'}</span>
      </div>`;

  html += section('Expéditeur');
  html += rl('Nom et prénom', r.exp_nom || '—');
  html += rl('Adresse', r.exp_adresse || '—');
  html += rl('Téléphone', r.exp_tel || '—');

  html += section('Destinataire');
  html += rl('Nom et prénom', r.dest_nom || '—');
  html += rl('Adresse', r.dest_adresse || '—');
  html += rl('Téléphone', r.dest_tel || '—');

  html += section('Détails de la facturation');
  html += rl('Nature', `${r.type_envoi || 'DOCUMENT'} — ${r.dest_pays || '—'} ${zoneStr}`);
  html += rl('Poids réel', `${r.poids_reel || 0} kg`);
  html += rl('Poids volumétrique', `${r.poids_vol || 0} kg`);
  html += rl('Poids payable', `${r.poids_fact || 0} kg`, true);
  html += rl('Valeur déclarée', r.valeur_declaree || '—');

  html += section('Détails financiers');
  html += rl('Tarif Guichet', fmtFcfa(r.tarif_guichet));
  html += rl('Surtaxe (carburant, éloignement ou risque pays)', fmtFcfa(r.surtaxe), true);

  html += `<div class="receipt-total"><span class="rl">Montant total à payer</span><span class="rv">${fmtFcfa(r.total_payer)}</span></div>`;

  html += `<div class="receipt-sigs">
      <div class="receipt-sig">Signature de l'Agent</div>
      <div class="receipt-sig">Signature du Client</div>
    </div>`;

  html += `</div>
    <div class="receipt-footer">BUELT — La Poste CI · Reçu généré localement, sans transmission de données · ${date}</div>
  </div>`;

  return html;
}

function showReceipt(resultat) {
  const sheet = document.getElementById('receiptSheet');
  sheet.innerHTML = buildReceiptHtml(resultat);
  document.getElementById('receiptOverlay').classList.remove('hidden');

  document.getElementById('receiptDownloadBtn').onclick = async () => {
    try {
      const res = await API.genererPdf(resultat);
      window.open(res.url, '_blank');
    } catch (err) {
      alert("Impossible de générer le PDF : " + err.message);
    }
  };
  document.getElementById('receiptPrintBtn').onclick = () => window.print();
}

function closeReceipt() {
  document.getElementById('receiptOverlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('receiptCloseBtn').addEventListener('click', closeReceipt);
});
