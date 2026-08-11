/**
 * preload.js — Bridge sécurisé Electron ↔ Frontend
 * Expose une API limitée au renderer via contextBridge
 * Mode local : toutes les opérations passent par IPC directement
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Authentification & données ──────────────────────────────────────
  login: (code) => ipcRenderer.invoke('auth-login', code),
  getCountries: () => ipcRenderer.invoke('get-countries'),

  // ── Calculs ─────────────────────────────────────────────────────────
  calculer: (params) => ipcRenderer.invoke('calculs-calculer', params),
  sauvegarder: (params) => ipcRenderer.invoke('calculs-sauvegarder', params),
  getHistorique: (opts) => ipcRenderer.invoke('calculs-historique', opts),
  getCalcul: (id) => ipcRenderer.invoke('calculs-get', id),
  updateCalcul: (id, params) => ipcRenderer.invoke('calculs-update', id, params),
  deleteCalcul: (id) => ipcRenderer.invoke('calculs-delete', id),

  // ── Admin ───────────────────────────────────────────────────────────
  getAdminStats: () => ipcRenderer.invoke('admin-stats'),
  getAdminOperations: () => ipcRenderer.invoke('admin-operations'),

  // ── PDF & Impression ────────────────────────────────────────────────
  openPdf: (pdfPath) => ipcRenderer.invoke('open-pdf', pdfPath),
  printPreview: () => ipcRenderer.invoke('print-preview'),
  printReceiptHtml: (html, waybill) => ipcRenderer.invoke('print-receipt-html', { html, waybill }),
  printToPdf: (waybill) => ipcRenderer.invoke('print-to-pdf', waybill),
  savePdfDialog: (defaultName) => ipcRenderer.invoke('save-pdf-dialog', defaultName),
  copyFile: (src, dest) => ipcRenderer.invoke('copy-file', src, dest),
  parseDhlPdfPath: (filePath) => ipcRenderer.invoke('parse-dhl-pdf-path', filePath),
  importDhlPdf: () => ipcRenderer.invoke('import-dhl-pdf'),
  listArchiveContents: (filePath) => ipcRenderer.invoke('list-archive-contents', filePath),
  extractAndParseArchiveFile: (filePath, innerFileName) => ipcRenderer.invoke('extract-and-parse-archive-file', filePath, innerFileName),

  // ── Utilitaires ─────────────────────────────────────────────────────
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('get-version')
});
