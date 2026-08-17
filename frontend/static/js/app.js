/**
 * frontend/static/js/app.js
 * Système BUELT — application web (Accueil / Reçu / EMS / DHL / Assistant IA).
 * Vanilla JS, pas de framework — rendu par re-génération de chaînes HTML.
 */

// ── Icônes (reprises de la maquette validée) ────────────────────────
const ICONS = {
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 9h8M8 13h8M8 17h5"></path></svg>',
  receipt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v17l-2.5-1.5L13 20l-1.5-1.5L10 20l-2.5-1.5L6 20V3z"></path><path d="M9 8h6M9 12h6"></path></svg>',
  ems: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><path d="M4 12h16M12 4c2.2 2.4 2.2 13.6 0 16M12 4c-2.2 2.4-2.2 13.6 0 16" stroke-linecap="round"></path></svg>',
  dhl: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-4 9 4v9l-9 4-9-4V8z"></path><path d="M3 8l9 4 9-4M12 12v9"></path></svg>',
  assistant: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-4 4v-4H4z"></path><path d="M8 9.5h8M8 12.5h5"></path></svg>'
};

const NAV_ITEMS = [
  { key: 'accueil', label: 'Accueil', icon: ICONS.home },
  { key: 'recu', label: 'Reçu', icon: ICONS.receipt },
  { key: 'ems', label: 'EMS', icon: ICONS.ems },
  { key: 'dhl', label: 'DHL', icon: ICONS.dhl },
  { key: 'assistant', label: 'Assistant IA', icon: ICONS.assistant }
];

const TITLES = {
  accueil: ["Accueil", "Vue d'ensemble des outils BUELT"],
  recu: ["Reçu", "Calcul rapide, import DHL ou saisie manuelle"],
  ems: ["EMS", "Calculateur, zones et grille tarifaire"],
  dhl: ["DHL", "Zones et grilles tarifaires"],
  assistant: ["Assistant IA", "Fonctionnalité bientôt disponible"]
};

function h(strings, ...vals) { return strings.reduce((s, str, i) => s + str + (vals[i] ?? ''), ''); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
// Même formule que backend/services/surtaxeService.js (calculerPoidsVolumetrique) —
// dupliquée ici uniquement pour un retour immédiat dans le champ "Vol" sans
// attendre l'aller-retour réseau du calcul complet (qui exige pays + poids réel).
function calcPoidsVolClient(l, w, h) {
  const L = parseFloat(l), W = parseFloat(w), H = parseFloat(h);
  if (!L || !W || !H) return null;
  return Math.round((L * W * H / 5000) * 100) / 100;
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// Ré-affiche en conservant le focus et la position du curseur sur le champ actif
// (indispensable ici : chaque frappe peut re-générer le HTML de l'écran).
function withFocusPreserved(renderFn) {
  const active = document.activeElement;
  const ds = active && active.dataset ? active.dataset : {};
  const trackedAttr = ds.field ? 'data-field' : (ds.emsCalcField ? 'data-ems-calc-field' : null);
  const trackedValue = trackedAttr === 'data-field' ? ds.field : (trackedAttr === 'data-ems-calc-field' ? ds.emsCalcField : null);
  const activeId = active && active.id;
  const selStart = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  const selEnd = active && typeof active.selectionEnd === 'number' ? active.selectionEnd : null;

  renderFn();

  const selector = trackedAttr ? `[${trackedAttr}="${trackedValue}"]` : (activeId ? `#${activeId}` : null);
  if (!selector) return;
  const el = document.querySelector(selector);
  if (!el) return;
  el.focus();
  if (selStart !== null && el.setSelectionRange) {
    try { el.setSelectionRange(selStart, selEnd); } catch (e) { /* ignore */ }
  }
}

// ── État global ──────────────────────────────────────────────────────
const state = {
  screen: 'accueil',
  countries: [],
  recu: {
    flow: null, // null | 'rapide' | 'import' | 'manuel'
    rapide: { waybill: '', agent_nom: '', exp_nom: '', exp_tel: '', dest_nom: '', dest_tel: '', dest_pays: '', nature: 'DOCUMENT', poids_reel: '', longueur: '', largeur: '', hauteur: '', poids_vol: '', montant_jour_dhl: '', result: null, error: null, suggestions: [] },
    manuel: { waybill: '', bureau_poste: 'COCODY', exp_nom: '', exp_tel: '', exp_adresse: '', dest_nom: '', dest_tel: '', dest_adresse: '', dest_pays: '', nature: 'DOCUMENT', poids_reel: '', longueur: '', largeur: '', hauteur: '', poids_vol: '', valeur_declaree: '', montant_jour_dhl: '', agent_nom: '', result: null, error: null, suggestions: [] },
    importState: { step: 'drop', archiveToken: null, files: [], parsed: null, error: null, busy: false }
  },
  ems: { tab: 'calc', zones: null, tarifZone: 1, tarifs: null, calc: { pays: '', poids: '', suggestions: [], result: null, error: null } },
  dhl: { tab: 'zones', search: '', type: 'colis', tarif: 'guichet', rows: null },
  assistant: { messages: [{ from: 'bot', text: "Bonjour, posez-moi une question sur les tarifs, zones ou formules DHL/EMS.", source: null }], input: '' },
  fab: { open: false, messages: [], input: '' }
};

function isMobile() { return window.matchMedia('(max-width: 900px)').matches; }

// ── Rendu de la navigation ───────────────────────────────────────────
function renderNav() {
  document.getElementById('sideNav').innerHTML = NAV_ITEMS.map(n => `
    <button class="nav-item${state.screen === n.key ? ' active' : ''}" data-nav="${n.key}">${n.icon}<span>${n.label}</span></button>
  `).join('');
  document.getElementById('bottomNav').innerHTML = NAV_ITEMS.map(n => `
    <button class="bottom-nav-item${state.screen === n.key ? ' active' : ''}" data-nav="${n.key}">${n.icon}<span>${n.label}</span></button>
  `).join('');
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => goScreen(btn.dataset.nav));
  });
}

function goScreen(key) {
  state.screen = key;
  if (key === 'recu') state.recu.flow = null;
  render();
}

// ── Rendu principal ──────────────────────────────────────────────────
function render() {
  renderNav();
  document.getElementById('pageTitle').textContent = TITLES[state.screen][0];
  document.getElementById('pageSubtitle').textContent = TITLES[state.screen][1];
  // Assistant IA temporairement désactivé (en cours d'entraînement) — le FAB
  // qui y donne accès partout dans l'app est donc masqué lui aussi.
  document.getElementById('fabBtn').classList.add('hidden');
  document.getElementById('fabPanel').classList.add('hidden');
  state.fab.open = false;

  const root = document.getElementById('screenRoot');
  if (state.screen === 'accueil') root.innerHTML = renderAccueil();
  else if (state.screen === 'recu') root.innerHTML = renderRecu();
  else if (state.screen === 'ems') root.innerHTML = renderEms();
  else if (state.screen === 'dhl') root.innerHTML = renderDhl();
  else if (state.screen === 'assistant') root.innerHTML = renderAssistant();

  wireScreen();
}

// ══════════════════════════════════════════════════════════════════
// ACCUEIL
// ══════════════════════════════════════════════════════════════════
function renderAccueil() {
  const cards = [
    { key: 'recu', icon: ICONS.receipt, title: 'Reçu', desc: "Calcul rapide, import DHL ou saisie manuelle d'un reçu." },
    { key: 'ems', icon: ICONS.ems, title: 'EMS', desc: 'Calculateur EMS, zones et grille tarifaire.' },
    { key: 'dhl', icon: ICONS.dhl, title: 'DHL', desc: 'Zones, pays et grilles tarifaires DHL (guichet / La Poste).' },
    { key: 'assistant', icon: ICONS.assistant, title: 'Assistant IA', desc: 'Fonctionnalité bientôt disponible.' }
  ];
  return h`
    <div style="font-size:15px; color:var(--body-text); margin-bottom:20px;">Que souhaitez-vous faire aujourd'hui ?</div>
    <div class="grid-cards">
      ${cards.map(c => `
        <button class="module-card" data-nav="${c.key}">
          <span class="module-icon-wrap">${c.icon.replace('currentColor', '#01604A')}</span>
          <div class="module-title">${c.title}</div>
          <div class="module-desc">${c.desc}</div>
        </button>
      `).join('')}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
// REÇU
// ══════════════════════════════════════════════════════════════════
function renderRecu() {
  const flow = state.recu.flow;
  if (!flow) return renderRecuHub();
  if (flow === 'rapide') return renderRecuRapide();
  if (flow === 'import') return renderRecuImport();
  if (flow === 'manuel') return renderRecuManuel();
}

function renderRecuHub() {
  const cards = [
    { key: 'rapide', title: 'Calcul rapide', desc: 'Destinataire, colis et tarif DHL en un seul écran.' },
    { key: 'import', title: 'Importer un reçu DHL', desc: 'Déposez un reçu DHL (PDF/ZIP/RAR) et vérifiez les informations extraites.' },
    { key: 'manuel', title: 'Saisie manuelle', desc: 'Renseignez expéditeur, destinataire et envoi en détail.' }
  ];
  return h`
    <div class="grid-cards grid-cards-3">
      ${cards.map(c => `
        <button class="module-card" data-flow="${c.key}">
          <div class="module-title">${c.title}</div>
          <div class="module-desc">${c.desc}</div>
        </button>
      `).join('')}
    </div>`;
}

function countrySuggestionsHtml(list, inputId, onPickAttr) {
  if (!list.length) return '';
  return `<div class="suggestions">${list.map(c => `
    <div class="suggestion-item" data-pick-country="${esc(c.nom)}" data-target="${inputId}"><span>${esc(c.nom)}</span><span class="zone">Zone ${c.zone}</span></div>
  `).join('')}</div>`;
}

function computeSuggestions(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  return state.countries.filter(c => c.nom.toLowerCase().startsWith(q)).slice(0, 6);
}

// ── Calcul rapide ────────────────────────────────────────────────────
function renderRecuRapide() {
  const f = state.recu.rapide;
  return h`
    <button class="back-link" data-back-recu>← Reçu</button>
    <div class="calc-grid">
      <div class="panel">
        <div class="section-heading">Destinataire</div>
        <div class="field-row">
          <div class="field"><div class="panel-label">Nom et prénom</div><input data-field="rapide.dest_nom" value="${esc(f.dest_nom)}" placeholder="Nom complet"></div>
          <div class="field"><div class="panel-label">Téléphone</div><input data-field="rapide.dest_tel" value="${esc(f.dest_tel)}" placeholder="+225 07 00 00 00 00"></div>
        </div>
        <div class="field" style="position:relative;">
          <div class="panel-label">Pays de destination</div>
          <input data-field="rapide.dest_pays" value="${esc(f.dest_pays)}" placeholder="ex : France" autocomplete="off">
          ${countrySuggestionsHtml(f.suggestions, 'rapide.dest_pays')}
        </div>

        <div class="section-heading" style="margin-top:8px;">Détail du colis</div>
        <div class="panel-label">Nature de l'envoi</div>
        <div class="seg-group">
          <button class="seg-btn${f.nature === 'DOCUMENT' ? ' active' : ''}" data-set="rapide.nature" data-val="DOCUMENT">Document (≤ 2kg)</button>
          <button class="seg-btn${f.nature === 'COLIS' ? ' active' : ''}" data-set="rapide.nature" data-val="COLIS">Colis / Non-document</button>
        </div>
        <div class="field"><div class="panel-label">Poids réel (kg)</div><input data-field="rapide.poids_reel" type="text" inputmode="decimal" step="0.1" min="0" value="${esc(f.poids_reel)}" placeholder="0.00"></div>
        <div class="panel-label">Dimensions (cm) L × l × H — facultatif, calcule le poids volumétrique</div>
        <div class="field-row4">
          <input data-field="rapide.longueur" type="text" inputmode="decimal" min="0" value="${esc(f.longueur)}" placeholder="L">
          <input data-field="rapide.largeur" type="text" inputmode="decimal" min="0" value="${esc(f.largeur)}" placeholder="l">
          <input data-field="rapide.hauteur" type="text" inputmode="decimal" min="0" value="${esc(f.hauteur)}" placeholder="H">
          <div></div>
        </div>
        <div style="font-size:11.5px; color:var(--placeholder); margin-top:8px; margin-bottom:14px;">Poids volumétrique = (L × l × H) ÷ 5000. Le poids payable est le plus élevé des deux.</div>

        <div class="section-heading" style="margin-top:8px;">Données tarifaires</div>
        <div class="field-row">
          <div class="field"><div class="panel-label">N° de suivi (Waybill)</div><input data-field="rapide.waybill" value="${esc(f.waybill)}" placeholder="Optionnel"></div>
          <div class="field"><div class="panel-label">Montant du jour DHL (FCFA)</div><input data-field="rapide.montant_jour_dhl" type="text" inputmode="decimal" min="0" value="${esc(f.montant_jour_dhl)}" placeholder="Ex : 33500"></div>
        </div>
        <div class="field-row">
          <div class="field"><div class="panel-label">Expéditeur (optionnel)</div><input data-field="rapide.exp_nom" value="${esc(f.exp_nom)}" placeholder="Nom complet"></div>
          <div class="field"><div class="panel-label">Nom de l'agent</div><input data-field="rapide.agent_nom" value="${esc(f.agent_nom)}" placeholder="Nom complet de l'agent"></div>
        </div>
      </div>

      <div class="result-panel">
        <div class="section-heading">Surtaxe calculée</div>
        ${f.error ? `<div class="error-box">${esc(f.error)}</div>` : ''}
        ${f.result ? renderResultBlock(f, 'rapide') : `<div class="result-empty">Renseignez le pays, le poids et le montant du jour DHL.</div>`}
      </div>
    </div>`;
}

// Aperçu complet du calcul — distinct du PDF officiel (structure figée).
// Toutes les informations utiles à la vérification par l'agent doivent
// apparaître ici, même si elles ne figurent pas toutes sur le reçu PDF.
function renderResultBlock(f, flowKey) {
  const r = f.result;
  const natureLabel = r.type_envoi === 'DOCUMENT' ? 'Document' : 'Colis';
  const dims = (f.longueur && f.largeur && f.hauteur) ? `${esc(f.longueur)} × ${esc(f.largeur)} × ${esc(f.hauteur)} cm` : null;
  return h`
    <div style="font-size:13px; color:var(--muted); margin:14px 0 10px;">${esc(f.dest_pays || '—')} · Zone ${r.zone} · ${natureLabel}${r.estForceColis ? ' (forcé en colis, > 2 kg)' : ''}</div>
    <div class="result-line"><span>Poids réel</span><span>${r.poids_reel} kg</span></div>
    ${dims ? `<div class="result-line"><span>Dimensions (L × l × H)</span><span>${dims}</span></div>` : ''}
    <div class="result-line"><span>Poids volumétrique</span><span>${r.poids_vol} kg</span></div>
    <div class="result-line" style="font-weight:700; color:var(--ink);"><span>Poids payable (facturable)</span><span>${r.poids_fact} kg</span></div>
    <div class="result-line"><span>Tranche tarifaire</span><span>${r.poids_tranche} kg</span></div>
    <div class="result-divider"></div>
    <div class="result-line"><span>Tarif vendu à La Poste</span><span>${fmt(r.tarif_poste)}</span></div>
    <div class="result-line"><span>Tarif guichet</span><span>${fmt(r.tarif_guichet)}</span></div>
    <div class="result-line"><span>Montant du jour DHL</span><span>${fmt(r.montant_jour_dhl)}</span></div>
    <div class="result-divider"></div>
    <div class="result-line"><span>Surtaxe</span><span>${fmt(r.surtaxe)}</span></div>
    <div class="receipt-total" style="margin-top:10px;"><span class="rl">Montant total à payer</span><span class="rv">${fmt(r.total_payer)}</span></div>
    <button class="btn-primary" data-generer="${flowKey}">Calculer &amp; générer le reçu</button>
    ${flowKey === 'rapide' ? `<button class="btn-secondary" style="width:100%; margin-top:10px;" data-continuer-expedition>Continuer l'expédition (ajouter les autres informations)</button>` : ''}`;
}

// ── Saisie manuelle ──────────────────────────────────────────────────
function renderRecuManuel() {
  const f = state.recu.manuel;
  return h`
    <button class="back-link" data-back-recu>← Reçu</button>
    <div class="calc-grid">
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div class="panel">
          <div class="section-heading">Informations d'envoi</div>
          <div class="field-row">
            <div class="field"><div class="panel-label">Numéro de suivi (Waybill)</div><input data-field="manuel.waybill" value="${esc(f.waybill)}" placeholder="Ex : 65651516"></div>
            <div class="field"><div class="panel-label">Bureau de poste</div><input data-field="manuel.bureau_poste" value="${esc(f.bureau_poste)}" placeholder="Ex : Cocody"></div>
          </div>
        </div>
        <div class="panel">
          <div class="section-heading">Expéditeur</div>
          <div class="field-row">
            <div class="field"><div class="panel-label">Nom et prénom</div><input data-field="manuel.exp_nom" value="${esc(f.exp_nom)}" placeholder="Ex : Koné Koffi"></div>
            <div class="field"><div class="panel-label">Téléphone</div><input data-field="manuel.exp_tel" value="${esc(f.exp_tel)}" placeholder="07 00 00 00 00"></div>
          </div>
          <div class="field"><div class="panel-label">Adresse</div><input data-field="manuel.exp_adresse" value="${esc(f.exp_adresse)}" placeholder="Ex : Cocody Cité des Arts"></div>
        </div>
        <div class="panel">
          <div class="section-heading">Destinataire</div>
          <div class="field-row">
            <div class="field"><div class="panel-label">Nom et prénom</div><input data-field="manuel.dest_nom" value="${esc(f.dest_nom)}" placeholder="Ex : Dupont Jean"></div>
            <div class="field"><div class="panel-label">Téléphone</div><input data-field="manuel.dest_tel" value="${esc(f.dest_tel)}" placeholder="+33 6 00 00 00 00"></div>
          </div>
          <div class="field-row">
            <div class="field"><div class="panel-label">Adresse</div><input data-field="manuel.dest_adresse" value="${esc(f.dest_adresse)}" placeholder="Ex : 15 Avenue des Champs-Élysées"></div>
            <div class="field" style="position:relative;">
              <div class="panel-label">Pays de destination</div>
              <input data-field="manuel.dest_pays" value="${esc(f.dest_pays)}" placeholder="Rechercher un pays…" autocomplete="off">
              ${countrySuggestionsHtml(f.suggestions, 'manuel.dest_pays')}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="section-heading">Détail du colis</div>
          <div class="panel-label">Nature de l'envoi</div>
          <div class="seg-group">
            <button class="seg-btn${f.nature === 'DOCUMENT' ? ' active' : ''}" data-set="manuel.nature" data-val="DOCUMENT">Document (≤ 2kg)</button>
            <button class="seg-btn${f.nature === 'COLIS' ? ' active' : ''}" data-set="manuel.nature" data-val="COLIS">Colis / Non-document</button>
          </div>
          <div class="field-row">
            <div class="field"><div class="panel-label">Valeur déclarée (facultatif)</div><input data-field="manuel.valeur_declaree" value="${esc(f.valeur_declaree)}" placeholder="—"></div>
            <div class="field"><div class="panel-label">Poids réel (kg)</div><input data-field="manuel.poids_reel" type="text" inputmode="decimal" step="0.1" min="0" value="${esc(f.poids_reel)}" placeholder="0.00"></div>
          </div>
          <div class="panel-label">Volume ou dimensions (cm) L × l × H — facultatif</div>
          <div class="field-row4">
            <input data-field="manuel.poids_vol" type="text" inputmode="decimal" step="0.01" min="0" value="${esc(f.poids_vol)}" placeholder="Vol">
            <input data-field="manuel.longueur" type="text" inputmode="decimal" min="0" value="${esc(f.longueur)}" placeholder="L">
            <input data-field="manuel.largeur" type="text" inputmode="decimal" min="0" value="${esc(f.largeur)}" placeholder="l">
            <input data-field="manuel.hauteur" type="text" inputmode="decimal" min="0" value="${esc(f.hauteur)}" placeholder="H">
          </div>
          <div style="font-size:11.5px; color:var(--placeholder); margin-top:8px;">Le champ « Vol » (poids volumétrique, kg) se calcule et se remplit automatiquement à partir de L × l × H ÷ 5000, ou peut être saisi directement (ex. valeur déjà connue via un import). Le poids payable retenu est le plus élevé entre le poids réel et le poids volumétrique.</div>
        </div>
        <div class="panel">
          <div class="section-heading">Données tarifaires</div>
          <div class="field"><div class="panel-label">Montant du jour DHL (FCFA)</div><input data-field="manuel.montant_jour_dhl" type="text" inputmode="decimal" min="0" value="${esc(f.montant_jour_dhl)}" placeholder="Ex : 33500"></div>
        </div>
        <div class="panel">
          <div class="section-heading">Agent</div>
          <div class="field"><div class="panel-label">Nom de l'agent</div><input data-field="manuel.agent_nom" value="${esc(f.agent_nom)}" placeholder="Nom complet de l'agent"></div>
        </div>
      </div>

      <div class="result-panel result-panel-sticky">
        <div class="section-heading">Surtaxe calculée</div>
        ${f.error ? `<div class="error-box">${esc(f.error)}</div>` : ''}
        ${f.result ? renderResultBlock(f, 'manuel') : `<div class="result-empty">Complétez le pays, le poids et le montant du jour DHL.</div>`}
      </div>
    </div>`;
}

// ── Import DHL ───────────────────────────────────────────────────────
function renderRecuImport() {
  const st = state.recu.importState;
  return h`
    <button class="back-link" data-back-recu>← Reçu</button>
    ${st.error ? `<div class="error-box">${esc(st.error)}</div>` : ''}
    ${st.step === 'drop' ? `
      <div class="dropzone" id="dropzone">
        <div style="display:flex; justify-content:center; margin-bottom:14px;">${ICONS.receipt.replace('currentColor', '#01604A').replace('20', '34').replace('20', '34')}</div>
        <div class="dz-title">Glissez-déposez le reçu DHL ici</div>
        <div class="dz-sub">ou cliquez pour parcourir vos fichiers — PDF, ZIP, RAR</div>
        <button class="btn-primary" id="pickFileBtn" style="width:auto; padding:11px 22px;" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Analyse en cours…' : 'Choisir un fichier'}</button>
        <input type="file" id="fileInput" accept=".pdf,.zip,.rar" style="display:none;">
      </div>` : ''}
    ${st.step === 'archive-list' ? `
      <div class="panel" style="max-width:520px; margin-top:14px;">
        <div class="section-heading">Fichiers PDF trouvés dans l'archive</div>
        ${st.files.length ? st.files.map(f => `<div class="suggestion-item" data-archive-entry="${esc(f)}"><span>${esc(f)}</span><span>→</span></div>`).join('') : '<div class="result-empty">Aucun PDF trouvé dans cette archive.</div>'}
        <button class="btn-secondary" data-reset-import style="width:100%; margin-top:14px;">Annuler</button>
      </div>` : ''}
    ${st.step === 'preview' && st.parsed ? renderImportPreview(st.parsed) : ''}
  `;
}

function renderImportPreview(data) {
  const rows = [
    ['Waybill', data.waybill],
    ['Expéditeur', data.exp_nom],
    ['Téléphone expéditeur', data.exp_tel],
    ['Adresse expéditeur', data.exp_adresse],
    ['Destinataire', data.dest_nom],
    ['Téléphone destinataire', data.dest_tel],
    ['Adresse destinataire', data.dest_adresse],
    ['Pays', data.dest_pays],
    ['Nature', data.type_envoi],
    ['Poids réel', data.poids_reel ? `${data.poids_reel} kg` : ''],
    ['Poids volumétrique', data.poids_vol ? `${data.poids_vol} kg` : ''],
    ['Valeur déclarée', data.valeur_declaree && data.valeur_declaree !== '—' ? data.valeur_declaree : ''],
    ['Montant du jour DHL', data.montant_jour_dhl ? fmt(data.montant_jour_dhl) : '']
  ];
  return h`
    <div class="panel" style="max-width:560px; margin-top:14px;">
      <div class="section-heading">Informations extraites</div>
      ${rows.map(([label, val]) => `<div class="receipt-line"><span class="rl">${esc(label)}</span><span class="rv">${esc(val) || '—'}</span></div>`).join('')}
      <div style="font-size:11.5px; color:var(--placeholder); margin-top:10px;">Les champs affichés « — » n'ont pas pu être extraits automatiquement — complétez-les dans la saisie manuelle.</div>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="btn-secondary" data-reset-import>Recommencer</button>
        <button class="btn-primary" data-use-import>Utiliser en saisie manuelle</button>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
// EMS — calculateur, zones et grille tarifaire
// ══════════════════════════════════════════════════════════════════
function emsSuggestionsHtml(list) {
  if (!list || !list.length) return '';
  return `<div class="suggestions">${list.map(c => `
    <div class="suggestion-item" data-pick-ems-country="${esc(c.nom)}"><span>${esc(c.nom)}</span><span class="zone">Zone ${c.zone}</span></div>
  `).join('')}</div>`;
}

function computeEmsSuggestions(list, query) {
  if (!query || query.length < 1 || !list) return [];
  const q = query.toLowerCase();
  return list.filter(c => c.nom.toLowerCase().startsWith(q)).slice(0, 6);
}

function renderEmsResultBlock(r) {
  return h`
    <div style="font-size:13px; color:var(--muted); margin:14px 0 10px;">${esc(r.dest_pays)} · Zone EMS ${r.zone}</div>
    <div class="result-line"><span>Poids</span><span>${r.poids} kg</span></div>
    <div class="result-line" style="font-weight:700; color:var(--ink);"><span>Tranche tarifaire</span><span>${r.band} kg</span></div>
    <div class="result-divider"></div>
    <div class="result-line"><span>Coût HT</span><span>${fmt(r.ht)}</span></div>
    <div class="result-line"><span>TVA</span><span>${fmt(r.tva)}</span></div>
    <div class="result-total"><span class="rl">Montant total (TTC)</span><span class="rv">${fmt(r.ttc)}</span></div>`;
}

function renderEms() {
  const s = state.ems;
  const tabs = [['calc', 'Calculateur'], ['zones', 'Zones'], ['tarifs', 'Tarifs']];
  let body = '';
  if (s.tab === 'calc') {
    const c = s.calc;
    body = `
      <div class="calc-grid">
        <div class="panel">
          <div class="section-heading">Calcul EMS</div>
          <div class="field" style="position:relative;">
            <div class="panel-label">Pays de destination</div>
            <input data-ems-calc-field="pays" value="${esc(c.pays)}" placeholder="ex : France" autocomplete="off">
            ${emsSuggestionsHtml(c.suggestions)}
          </div>
          <div class="field"><div class="panel-label">Poids (kg)</div><input data-ems-calc-field="poids" type="text" inputmode="decimal" step="0.1" min="0" value="${esc(c.poids)}" placeholder="0.00"></div>
        </div>
        <div class="result-panel">
          <div class="section-heading">Tarif EMS</div>
          ${c.error ? `<div class="error-box">${esc(c.error)}</div>` : ''}
          ${c.result ? renderEmsResultBlock(c.result) : `<div class="result-empty">Renseignez le pays et le poids.</div>`}
        </div>
      </div>`;
  } else if (s.tab === 'zones') {
    if (!s.zones) body = '<div class="result-empty">Chargement…</div>';
    else body = `
      <div class="grid-cards grid-cards-3">
        ${s.zones.zones.map(z => `
          <div class="panel">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
              <span class="heading-font" style="font-weight:700; font-size:17px;">Zone ${z.zone}</span>
              <span class="zone-chip">${z.countryCount} pays</span>
            </div>
            <div style="font-size:13.5px; color:var(--body-text); line-height:1.6;">${esc(z.countries)}</div>
          </div>
        `).join('')}
      </div>`;
  } else if (s.tab === 'tarifs') {
    body = `
      <div class="seg-group">
        ${[1, 2, 3].map(z => `<button class="seg-btn${s.tarifZone === z ? ' active' : ''}" data-ems-zone="${z}">Zone ${z}</button>`).join('')}
      </div>
      ${!s.tarifs ? '<div class="result-empty">Chargement…</div>' : `
      <div class="panel data-table-wrap" style="max-height:520px; overflow:auto; padding:0;">
        <table class="data-table">
          <thead><tr><th>Poids (kg)</th><th>Coût HT</th><th>TVA</th><th>Coût TTC</th></tr></thead>
          <tbody>${s.tarifs.rates.map(r => `<tr><td>${r.band} kg</td><td>${fmt(r.ht)}</td><td>${fmt(r.tva)}</td><td class="bold">${fmt(r.ttc)}</td></tr>`).join('')}</tbody>
        </table>
      </div>`}`;
  }
  return h`
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab-btn${s.tab === k ? ' active' : ''}" data-ems-tab="${k}">${l}</button>`).join('')}</div>
    ${body}`;
}

// ══════════════════════════════════════════════════════════════════
// DHL
// ══════════════════════════════════════════════════════════════════
function renderDhl() {
  const s = state.dhl;
  const tabs = [['zones', 'Zones'], ['tarifs', 'Grille tarifaire']];
  let body = '';
  if (s.tab === 'zones') {
    const counts = {};
    state.countries.forEach(c => { counts[c.zone] = (counts[c.zone] || 0) + 1; });
    const zoneSummary = Object.keys(counts).sort((a, b) => a - b).map(z => `<div class="panel" style="padding:12px 10px; text-align:center;"><div style="font-family:'Sora',sans-serif; font-weight:700; font-size:16px;">Zone ${z}</div><div style="font-size:11.5px; color:var(--muted);">${counts[z]} pays</div></div>`).join('');
    const q = s.search.toLowerCase();
    const filtered = (q ? state.countries.filter(c => c.nom.toLowerCase().includes(q)) : state.countries).slice(0, 80);
    body = `
      <div class="grid-cards" style="grid-template-columns:repeat(auto-fit,minmax(90px,1fr)); gap:8px; margin-bottom:18px;">${zoneSummary}</div>
      <div class="field" style="max-width:360px;"><input id="dhlSearch" value="${esc(s.search)}" placeholder="Rechercher un pays…"></div>
      <div class="panel data-table-wrap" style="max-height:480px; overflow:auto; padding:0;">
        <table class="data-table">
          <thead><tr><th>Pays</th><th>Zone</th></tr></thead>
          <tbody>${filtered.map(c => `<tr><td>${esc(c.nom)}</td><td><span class="zone-chip">Zone ${c.zone}</span></td></tr>`).join('')}</tbody>
        </table>
      </div>`;
  } else {
    body = `
      <div style="display:flex; gap:24px; flex-wrap:wrap; margin-bottom:14px;">
        <div>
          <div class="panel-label">Nature</div>
          <div class="seg-group" style="margin-bottom:0;">
            <button class="seg-btn${s.type === 'doc' ? ' active' : ''}" data-dhl-type="doc">Document</button>
            <button class="seg-btn${s.type === 'colis' ? ' active' : ''}" data-dhl-type="colis">Colis</button>
          </div>
        </div>
        <div>
          <div class="panel-label">Tarif affiché</div>
          <div class="seg-group" style="margin-bottom:0;">
            <button class="seg-btn${s.tarif === 'guichet' ? ' active' : ''}" data-dhl-tarif="guichet">Tarif guichet</button>
            <button class="seg-btn${s.tarif === 'poste' ? ' active' : ''}" data-dhl-tarif="poste">Tarif vendu à la poste</button>
          </div>
        </div>
      </div>
      ${!s.rows ? '<div class="result-empty">Chargement…</div>' : `
      <div class="panel data-table-wrap" style="max-height:520px; overflow:auto; padding:0;">
        <table class="data-table">
          <thead><tr><th>Poids (kg)</th>${[1, 2, 3, 4, 5, 6, 7, 8].map(z => `<th>Zone ${z}</th>`).join('')}</tr></thead>
          <tbody>${s.rows.map(r => `<tr><td class="bold">${r.poids}</td>${r.zones.map(v => `<td>${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`}`;
  }
  return h`
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab-btn${s.tab === k ? ' active' : ''}" data-dhl-tab="${k}">${l}</button>`).join('')}</div>
    ${body}`;
}

// ══════════════════════════════════════════════════════════════════
// ASSISTANT IA
// ══════════════════════════════════════════════════════════════════
function renderChatMessages(messages) {
  return messages.map(m => `
    <div class="chat-msg ${m.from === 'user' ? 'user' : 'bot'}">
      <div class="chat-bubble">${esc(m.text)}</div>
      ${m.source ? `<div class="chat-source">Source : ${esc(m.source)}</div>` : ''}
    </div>`).join('');
}

// L'assistant est temporairement désactivé côté interface (en cours
// d'entraînement/amélioration) — le backend (/api/assistant/ask) et toute la
// logique de chat restent en place pour ne rien perdre, simplement non
// exposés aux agents tant qu'il n'est pas jugé assez fiable.
function renderAssistant() {
  return h`
    <div class="soon-card">
      <div class="soon-title">Fonctionnalité bientôt disponible</div>
      <div>L'Assistant IA est en cours d'amélioration et sera réactivé une fois entraîné sur des cas réels plus complets.</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
// CÂBLAGE DES ÉVÉNEMENTS PAR ÉCRAN
// ══════════════════════════════════════════════════════════════════
function setDeep(path, value) {
  const [ns, key] = path.split('.');
  state.recu[ns][key] = value;
}
function getDeep(path) {
  const [ns, key] = path.split('.');
  return state.recu[ns][key];
}

const debouncedCalc = debounce((ns) => runCalc(ns), 400);
const debouncedEmsCalc = debounce(() => runEmsCalc(), 400);

async function runCalc(ns) {
  const f = state.recu[ns];
  if (!f.dest_pays || !f.poids_reel) { f.result = null; f.error = null; return; }
  try {
    const params = {
      dest_pays: f.dest_pays,
      poids_reel: f.poids_reel,
      type_envoi: f.nature,
      montant_jour_dhl: f.montant_jour_dhl || 0,
      longueur: f.longueur, largeur: f.largeur, hauteur: f.hauteur,
      poids_vol: f.poids_vol || 0
    };
    const res = await API.calculer(params);
    f.result = res.resultat;
    f.error = null;
    // Le champ "Vol" affiche toujours le poids volumétrique réellement retenu
    // (calculé depuis L×l×H, ou la valeur saisie/importée directement).
    f.poids_vol = res.resultat.poids_vol || '';
  } catch (err) {
    f.result = null;
    f.error = err.message;
  }
  withFocusPreserved(renderCurrentFlowOnly);
}

async function runEmsCalc() {
  const c = state.ems.calc;
  if (!c.pays || !c.poids) { c.result = null; c.error = null; withFocusPreserved(renderCurrentFlowOnly); return; }
  try {
    const res = await API.emsCalculer(c.pays, c.poids);
    c.result = res.resultat;
    c.error = null;
  } catch (err) {
    c.result = null;
    c.error = err.message;
  }
  withFocusPreserved(renderCurrentFlowOnly);
}

async function genererRecu(ns) {
  const f = state.recu[ns];
  if (!f.result) return;
  try {
    const params = {
      waybill: f.waybill || '',
      exp_nom: f.exp_nom || '', exp_tel: f.exp_tel || '', exp_adresse: f.exp_adresse || '',
      dest_nom: f.dest_nom || '', dest_tel: f.dest_tel || '', dest_adresse: f.dest_adresse || '',
      dest_pays: f.dest_pays, type_envoi: f.nature,
      poids_reel: f.poids_reel, longueur: f.longueur, largeur: f.largeur, hauteur: f.hauteur,
      poids_vol: f.poids_vol || 0,
      valeur_declaree: f.valeur_declaree || '—',
      montant_jour_dhl: f.montant_jour_dhl || 0,
      bureau_poste: f.bureau_poste || 'COCODY',
      agent_nom: f.agent_nom || 'Agent'
    };
    const res = await API.sauvegarder(params);
    showReceipt(res.resultat);
  } catch (err) {
    f.error = err.message;
    render();
  }
}

function wireScreen() {
  // Navigation cartes Accueil
  document.querySelectorAll('[data-nav]').forEach(el => {
    if (el.tagName === 'BUTTON' && el.classList.contains('module-card')) {
      el.addEventListener('click', () => goScreen(el.dataset.nav));
    }
  });

  // Reçu — choix de flux
  document.querySelectorAll('[data-flow]').forEach(el => el.addEventListener('click', () => { state.recu.flow = el.dataset.flow; render(); }));
  document.querySelectorAll('[data-back-recu]').forEach(el => el.addEventListener('click', () => { state.recu.flow = null; render(); }));

  // Champs texte des formulaires Reçu
  document.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', () => {
      const path = el.dataset.field;
      setDeep(path, el.value);
      const ns = path.split('.')[0];
      if (path.endsWith('dest_pays')) {
        state.recu[ns].suggestions = computeSuggestions(el.value);
        withFocusPreserved(renderCurrentFlowOnly);
      }
      if (['longueur', 'largeur', 'hauteur'].some(k => path.endsWith(k))) {
        // Calcul immédiat (sans attendre le serveur) dès que L, l et H sont
        // renseignés — remplit directement le champ "Vol". Prime sur un poids
        // volumétrique saisi/importé manuellement tant que les 3 dimensions
        // ne sont pas toutes vidées à nouveau.
        const f2 = state.recu[ns];
        const volCalcule = calcPoidsVolClient(f2.longueur, f2.largeur, f2.hauteur);
        f2.poids_vol = volCalcule !== null ? String(volCalcule) : '';
        withFocusPreserved(renderCurrentFlowOnly);
      }
      if (['poids_reel', 'montant_jour_dhl', 'dest_pays', 'longueur', 'largeur', 'hauteur', 'poids_vol'].some(k => path.endsWith(k))) {
        debouncedCalc(ns);
      }
    });
  });

  // Suggestions pays (clic)
  document.querySelectorAll('[data-pick-country]').forEach(el => {
    el.addEventListener('click', () => {
      const path = el.dataset.target;
      const ns = path.split('.')[0];
      setDeep(path, el.dataset.pickCountry);
      state.recu[ns].suggestions = [];
      // Affiche immédiatement le pays choisi et referme la liste — runCalc()
      // ne redessine l'écran qu'une fois le calcul terminé (et pas du tout
      // si le poids n'est pas encore renseigné), donc sans ce rendu explicite
      // le clic semblait ne rien faire tant qu'on ne changeait pas d'écran.
      render();
      runCalc(ns);
    });
  });

  // Segmented controls (nature document/colis)
  document.querySelectorAll('[data-set]').forEach(el => {
    el.addEventListener('click', () => {
      const path = el.dataset.set;
      setDeep(path, el.dataset.val);
      const ns = path.split('.')[0];
      // Même raison : on reflète le choix immédiatement, indépendamment du calcul.
      render();
      runCalc(ns);
    });
  });

  // Générer le reçu
  document.querySelectorAll('[data-generer]').forEach(el => el.addEventListener('click', () => genererRecu(el.dataset.generer)));

  // Depuis le Calcul rapide : reprendre les infos déjà saisies pour compléter
  // le reste (adresses, bureau de poste, valeur déclarée…) en saisie manuelle.
  document.querySelectorAll('[data-continuer-expedition]').forEach(el => el.addEventListener('click', () => {
    const f = state.recu.rapide;
    state.recu.manuel = {
      ...state.recu.manuel,
      waybill: f.waybill,
      agent_nom: f.agent_nom,
      exp_nom: f.exp_nom,
      exp_tel: f.exp_tel,
      dest_nom: f.dest_nom,
      dest_tel: f.dest_tel,
      dest_pays: f.dest_pays,
      nature: f.nature,
      poids_reel: f.poids_reel,
      longueur: f.longueur,
      largeur: f.largeur,
      hauteur: f.hauteur,
      poids_vol: f.poids_vol,
      montant_jour_dhl: f.montant_jour_dhl
    };
    state.recu.flow = 'manuel';
    render();
    runCalc('manuel');
  }));

  // Import DHL
  wireImport();

  // EMS
  document.querySelectorAll('[data-ems-tab]').forEach(el => el.addEventListener('click', () => { state.ems.tab = el.dataset.emsTab; loadEmsTabData(); render(); }));
  document.querySelectorAll('[data-ems-zone]').forEach(el => el.addEventListener('click', () => { state.ems.tarifZone = Number(el.dataset.emsZone); state.ems.tarifs = null; render(); loadEmsTabData(); }));
  document.querySelectorAll('[data-ems-calc-field]').forEach(el => {
    el.addEventListener('input', () => {
      const key = el.dataset.emsCalcField;
      state.ems.calc[key] = el.value;
      if (key === 'pays') {
        const countryList = (state.ems.zones && state.ems.zones.countriesList) || [];
        state.ems.calc.suggestions = computeEmsSuggestions(countryList, el.value);
        withFocusPreserved(renderCurrentFlowOnly);
      }
      debouncedEmsCalc();
    });
  });
  document.querySelectorAll('[data-pick-ems-country]').forEach(el => {
    el.addEventListener('click', () => {
      state.ems.calc.pays = el.dataset.pickEmsCountry;
      state.ems.calc.suggestions = [];
      runEmsCalc();
    });
  });

  // DHL
  document.querySelectorAll('[data-dhl-tab]').forEach(el => el.addEventListener('click', () => { state.dhl.tab = el.dataset.dhlTab; render(); loadDhlTabData(); }));
  document.querySelectorAll('[data-dhl-type]').forEach(el => el.addEventListener('click', () => { state.dhl.type = el.dataset.dhlType; state.dhl.rows = null; render(); loadDhlTabData(); }));
  document.querySelectorAll('[data-dhl-tarif]').forEach(el => el.addEventListener('click', () => { state.dhl.tarif = el.dataset.dhlTarif; state.dhl.rows = null; render(); loadDhlTabData(); }));
  const dhlSearch = document.getElementById('dhlSearch');
  if (dhlSearch) dhlSearch.addEventListener('input', () => { state.dhl.search = dhlSearch.value; withFocusPreserved(renderCurrentFlowOnly); });

  // Assistant IA (page)
  const chatForm = document.getElementById('chatForm');
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => { e.preventDefault(); sendChat(); });
    document.getElementById('chatInput').addEventListener('input', (e) => {
      state.assistant.input = e.target.value;
      chatForm.querySelector('button').disabled = !e.target.value.trim();
    });
  }
  document.querySelectorAll('[data-ask]').forEach(el => el.addEventListener('click', () => { sendChat(el.dataset.ask); }));

  if (state.screen === 'ems') loadEmsTabData();
  if (state.screen === 'dhl') loadDhlTabData();
}

// Ré-affiche uniquement l'écran courant (pour les mises à jour légères type saisie/recherche)
function renderCurrentFlowOnly() {
  const root = document.getElementById('screenRoot');
  if (state.screen === 'recu') root.innerHTML = renderRecu();
  else if (state.screen === 'dhl') root.innerHTML = renderDhl();
  else if (state.screen === 'ems') root.innerHTML = renderEms();
  else return render();
  wireScreen();
}

// ── Import DHL : logique ─────────────────────────────────────────────
function wireImport() {
  const dz = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const pickBtn = document.getElementById('pickFileBtn');
  if (pickBtn) pickBtn.addEventListener('click', () => fileInput.click());
  if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleImportFile(fileInput.files[0]); });
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); dz.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]);
    });
  }
  document.querySelectorAll('[data-archive-entry]').forEach(el => {
    el.addEventListener('click', () => handleArchiveEntry(el.dataset.archiveEntry));
  });
  document.querySelectorAll('[data-reset-import]').forEach(el => el.addEventListener('click', () => {
    state.recu.importState = { step: 'drop', archiveToken: null, files: [], parsed: null, error: null, busy: false };
    render();
  }));
  document.querySelectorAll('[data-use-import]').forEach(el => el.addEventListener('click', () => {
    const data = state.recu.importState.parsed;
    state.recu.manuel = { ...state.recu.manuel, ...data, poids_vol: data.poids_vol || '', nature: data.type_envoi || 'DOCUMENT' };
    state.recu.flow = 'manuel';
    render();
    runCalc('manuel');
  }));
}

async function handleImportFile(file) {
  const st = state.recu.importState;
  st.busy = true; st.error = null; render();
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await API.importDhl(formData);
    if (res.isArchive) {
      st.step = 'archive-list'; st.archiveToken = res.archiveToken; st.files = res.files; st.busy = false;
    } else if (res.ok && res.data) {
      st.step = 'preview'; st.parsed = res.data; st.busy = false;
    } else {
      st.error = res.error || "Impossible d'analyser ce fichier."; st.busy = false;
    }
  } catch (err) {
    st.error = err.message; st.busy = false;
  }
  render();
}

async function handleArchiveEntry(innerFileName) {
  const st = state.recu.importState;
  st.busy = true; render();
  try {
    const res = await API.importDhlEntry(st.archiveToken, innerFileName);
    if (res.ok && res.data) { st.step = 'preview'; st.parsed = res.data; }
    else st.error = res.error || "Impossible d'analyser ce fichier.";
  } catch (err) {
    st.error = err.message;
  }
  st.busy = false;
  render();
}

// ── EMS / DHL : chargement des données de référence ──────────────────
async function loadEmsTabData() {
  const s = state.ems;
  try {
    // La liste des pays (countriesList) sert à la fois à l'onglet Zones et à
    // l'autocomplétion du calculateur — on la charge dès qu'un des deux est actif.
    if ((s.tab === 'zones' || s.tab === 'calc') && !s.zones) { s.zones = await API.emsZones(); render(); }
    if (s.tab === 'tarifs' && !s.tarifs) { s.tarifs = await API.emsTarifs(s.tarifZone); render(); }
  } catch (err) { /* silencieux — l'écran affiche déjà un état de chargement */ }
}

async function loadDhlTabData() {
  const s = state.dhl;
  if (s.tab === 'tarifs' && !s.rows) {
    try {
      const res = await API.dhlTarifs(s.type, s.tarif);
      s.rows = res.rows;
      render();
    } catch (err) { /* silencieux */ }
  }
}

// ── Assistant : envoi de message ──────────────────────────────────────
async function sendChat(text) {
  const q = (text || state.assistant.input).trim();
  if (!q) return;
  state.assistant.messages.push({ from: 'user', text: q, source: null });
  state.assistant.input = '';
  render();
  try {
    const res = await API.ask(q);
    state.assistant.messages.push({ from: 'bot', text: res.answer, source: res.source });
  } catch (err) {
    state.assistant.messages.push({ from: 'bot', text: "Erreur : " + err.message, source: null });
  }
  render();
  const panel = document.getElementById('chatPanel');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

async function sendFab() {
  const q = state.fab.input.trim();
  if (!q) return;
  state.fab.messages.push({ from: 'user', text: q });
  state.fab.input = '';
  renderFab();
  try {
    const res = await API.ask(q);
    state.fab.messages.push({ from: 'bot', text: res.answer });
  } catch (err) {
    state.fab.messages.push({ from: 'bot', text: "Erreur : " + err.message });
  }
  renderFab();
}

function renderFab() {
  document.getElementById('fabMessages').innerHTML = state.fab.messages.map(m => `
    <div class="chat-msg ${m.from === 'user' ? 'user' : 'bot'}"><div class="chat-bubble">${esc(m.text)}</div></div>
  `).join('');
  document.getElementById('fabInput').value = state.fab.input;
  const messagesEl = document.getElementById('fabMessages');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Déconnexion automatique après inactivité (5 min, aligné sur la session
// glissante côté serveur — voir backend/services/sessionService.js) ────────
const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;
let inactivityTimer = null;

function resetInactivityTimer() {
  if (!inactivityTimer) return; // pas connecté : rien à surveiller
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(async () => {
    try { await API.logout(); } catch (err) { /* ignore */ }
    showLogin('Session expirée après 5 minutes d\'inactivité, veuillez vous reconnecter.');
  }, INACTIVITY_LIMIT_MS);
}

function startInactivityWatch() {
  inactivityTimer = setTimeout(() => {}, 0); // marque "connecté" pour resetInactivityTimer
  resetInactivityTimer();
}

function stopInactivityWatch() {
  clearTimeout(inactivityTimer);
  inactivityTimer = null;
}

// ══════════════════════════════════════════════════════════════════
// AMORÇAGE APPLICATION
// ══════════════════════════════════════════════════════════════════
async function bootApp() {
  try {
    state.countries = (await API.countries()).countries;
  } catch (err) { /* l'écran DHL affichera une liste vide si l'appel échoue */ }
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  startInactivityWatch();
  render();
}

function showLogin(message) {
  stopInactivityWatch();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginError').textContent = message || '';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('loginCode').value;
    try {
      await API.login(code);
      bootApp();
    } catch (err) {
      showLogin('Code incorrect.');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await API.logout(); } catch (err) { /* ignore */ }
    showLogin('');
  });

  document.getElementById('fabBtn').addEventListener('click', () => {
    state.fab.open = !state.fab.open;
    document.getElementById('fabPanel').classList.toggle('hidden', !state.fab.open);
    if (state.fab.open) renderFab();
  });
  document.getElementById('fabForm').addEventListener('submit', (e) => { e.preventDefault(); sendFab(); });
  document.getElementById('fabInput').addEventListener('input', (e) => { state.fab.input = e.target.value; });

  window.addEventListener('buelt:unauthorized', () => showLogin('Session expirée, veuillez vous reconnecter.'));

  // Réinitialise le minuteur d'inactivité à la moindre interaction (sans
  // effet tant que personne n'est connecté — voir resetInactivityTimer).
  ['click', 'keydown', 'mousemove', 'touchstart', 'input', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, { passive: true });
  });

  // Vérifie si une session est déjà active (rechargement de page)
  API.me().then(() => bootApp()).catch(() => showLogin(''));
});
