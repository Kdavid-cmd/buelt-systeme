/**
 * frontend/static/js/api.js
 * Petit client HTTP pour l'API REST du Système BUELT.
 * Toutes les requêtes incluent le cookie de session (credentials: 'include').
 */
const API = {
  async _req(method, path, body, isForm) {
    const opts = { method, credentials: 'include' };
    if (body !== undefined) {
      if (isForm) {
        opts.body = body; // FormData — laisse le navigateur poser le Content-Type
      } else {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(path, opts);
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('buelt:unauthorized'));
      throw new Error('Session expirée, veuillez vous reconnecter.');
    }
    let data;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok || (data && data.ok === false)) {
      const msg = (data && (data.error || data.message)) || `Erreur ${res.status}`;
      throw new Error(msg);
    }
    return data;
  },

  get(path) { return this._req('GET', path); },
  post(path, body) { return this._req('POST', path, body || {}); },
  put(path, body) { return this._req('PUT', path, body || {}); },
  del(path) { return this._req('DELETE', path); },
  postForm(path, formData) { return this._req('POST', path, formData, true); },

  // ── Auth ──
  login(code) { return this.post('/api/auth/login', { code }); },
  logout() { return this.post('/api/auth/logout'); },
  me() { return this.get('/api/auth/me'); },
  countries() { return this.get('/api/auth/countries'); },

  // ── Calculs DHL ──
  calculer(params) { return this.post('/api/calculs/calculer', params); },
  sauvegarder(params) { return this.post('/api/calculs/sauvegarder', params); },

  // ── PDF ──
  genererPdf(data) { return this.post('/api/pdf/generer', data); },

  // ── Import DHL ──
  importDhl(formData) { return this.postForm('/api/import/dhl', formData); },
  importDhlEntry(archiveToken, innerFileName) { return this.post('/api/import/dhl/entry', { archiveToken, innerFileName }); },

  // ── EMS (référence + calculateur) ──
  emsZones() { return this.get('/api/ems/zones'); },
  emsTarifs(zone) { return this.get(`/api/ems/tarifs?zone=${zone}`); },
  emsCalculer(dest_pays, poids) { return this.post('/api/ems/calculer', { dest_pays, poids }); },

  // ── DHL grilles ──
  dhlTarifs(type, tarif) { return this.get(`/api/dhl/tarifs?type=${type}&tarif=${tarif}`); },

  // ── Assistant ──
  ask(question) { return this.post('/api/assistant/ask', { question }); }
};
