/**
 * main.js
 * Processus principal Electron
 * Mode local : toutes les opérations passent par IPC (pas de serveur HTTP)
 */
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const AdmZip = require('adm-zip');
const { createExtractorFromFile } = require('node-unrar-js');
// Assurer qu'une seule instance de l'application s'exécute à la fois
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── Chemins adaptatifs (développement vs. app packagée) ──────────────
const IS_PACKAGED = app.isPackaged;

function getAppDir() {
  // En mode packagé, les données utilisateur (DB, PDFs, logs) vont dans userData
  return IS_PACKAGED ? app.getPath('userData') : path.join(__dirname);
}

const GENERATED_DIR = path.join(getAppDir(), 'generated');
const LOGS_DIR      = path.join(getAppDir(), 'logs');
const DATABASE_DIR  = path.join(getAppDir(), 'database');

// Créer les dossiers nécessaires au démarrage
function ensureDirs() {
  [GENERATED_DIR, LOGS_DIR, DATABASE_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

// Exporter les chemins pour que le backend les utilise
global.APP_PATHS = { GENERATED_DIR, LOGS_DIR, DATABASE_DIR, IS_PACKAGED };

// ── Importer les modules backend directement (sans serveur HTTP) ─────
const { initDb } = require('./backend/database/db');
const { verifierCode } = require('./backend/models/user');
const { calculerSurtaxes, PAYS_LIST } = require('./backend/services/surtaxeService');
const { sauvegarderCalcul, mettreAjourCalcul, listerCalculs, trouverCalcul, supprimerCalcul, compterCalculs } = require('./backend/models/calcul');
const { getAdminStats } = require('./backend/database/db');
const { parseDhlReceipt } = require('./backend/services/pdfParserService');
const { genererNumeroRecu } = (() => {
  // Générateur de numéro de reçu simple si non disponible dans surtaxeService
  try {
    const mod = require('./backend/services/surtaxeService');
    if (mod.genererNumeroRecu) return mod;
  } catch {}
  return { genererNumeroRecu: () => 'REC-' + Date.now() };
})();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'frontend', 'static', 'img', 'laposte-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Charger le frontend
  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));

  // Ouvrir les liens externes ou PDF dans le navigateur par défaut
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC Listeners — API locale (remplace le serveur Express) ────────

// ── Authentification ────────────────────────────────────────────────
ipcMain.handle('auth-login', async (event, code) => {
  try {
    const role = verifierCode(code);
    if (role) {
      return { ok: true, role };
    } else {
      return { ok: false, message: 'Code incorrect' };
    }
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

// ── Liste des pays ─────────────────────────────────────────────────
ipcMain.handle('get-countries', async () => {
  try {
    const sorted = [...PAYS_LIST].sort((a, b) => a.nom.localeCompare(b.nom));
    return { ok: true, countries: sorted };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Calculer (sans sauvegarder) ────────────────────────────────────
ipcMain.handle('calculs-calculer', async (event, params) => {
  try {
    const resultat = calculerSurtaxes(params);
    return { ok: true, resultat };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Calculer ET sauvegarder ────────────────────────────────────────
ipcMain.handle('calculs-sauvegarder', async (event, params) => {
  try {
    const resultat = calculerSurtaxes(params);
    const { genererNumeroRecu: genNumero } = require('./backend/database/db');
    const bureau = params.bureau_poste || 'COCODY';
    const numero_recu = await genNumero(bureau);

    const enregistrement = await sauvegarderCalcul({
      waybill:       params.waybill || '',
      exp_nom:       params.exp_nom,
      exp_tel:       params.exp_tel,
      exp_adresse:   params.exp_adresse || '',
      dest_nom:      params.dest_nom,
      dest_tel:      params.dest_tel,
      dest_adresse:  params.dest_adresse || '',
      dest_pays:     params.dest_pays,
      poids_reel:    resultat.poids_reel,
      poids_vol:     resultat.poids_vol,
      poids_fact:    resultat.poids_fact,
      zone:          resultat.zone,
      longueur:      params.longueur || 0,
      largeur:       params.largeur  || 0,
      hauteur:       params.hauteur  || 0,
      valeur_declaree: params.valeur_declaree || '—',
      service:       params.service || 'EXPRESS',
      type_envoi:    resultat.type_envoi || params.type_envoi || 'DOCUMENT',
      tarif_guichet:    resultat.tarif_guichet,
      tarif_poste:      resultat.tarif_poste,
      montant_jour_dhl: resultat.montant_jour_dhl,
      surtaxe:          resultat.surtaxe,
      total_payer:      resultat.total_payer,
      bureau_poste:  bureau,
      agent_nom:     params.agent_nom,
      numero_recu
    });

    return { ok: true, resultat: { ...resultat, ...enregistrement, numero_recu } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Historique ─────────────────────────────────────────────────────
ipcMain.handle('calculs-historique', async (event, { limit = 50, offset = 0 } = {}) => {
  try {
    const calculs = await listerCalculs({ limit: Math.min(limit, 200), offset });
    const total = await compterCalculs();
    return { ok: true, calculs, total };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Un calcul par ID ──────────────────────────────────────────────
ipcMain.handle('calculs-get', async (event, id) => {
  try {
    const calcul = await trouverCalcul(id);
    if (!calcul) return { ok: false, error: 'Calcul introuvable' };
    return { ok: true, calcul };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Modifier un calcul ───────────────────────────────────────────
ipcMain.handle('calculs-update', async (event, id, params) => {
  try {
    const resultat = calculerSurtaxes(params);
    const updatedData = {
      waybill:       params.waybill || '',
      exp_nom:       params.exp_nom,
      exp_tel:       params.exp_tel,
      exp_adresse:   params.exp_adresse || '',
      dest_nom:      params.dest_nom,
      dest_tel:      params.dest_tel,
      dest_adresse:  params.dest_adresse || '',
      dest_pays:     params.dest_pays,
      poids_reel:    resultat.poids_reel,
      poids_vol:     resultat.poids_vol,
      poids_fact:    resultat.poids_fact,
      zone:          resultat.zone,
      longueur:      params.longueur || 0,
      largeur:       params.largeur  || 0,
      hauteur:       params.hauteur  || 0,
      valeur_declaree: params.valeur_declaree || '—',
      service:       params.service || 'EXPRESS',
      type_envoi:    resultat.type_envoi || params.type_envoi || 'DOCUMENT',
      tarif_guichet:    resultat.tarif_guichet,
      tarif_poste:      resultat.tarif_poste,
      montant_jour_dhl: resultat.montant_jour_dhl,
      surtaxe:          resultat.surtaxe,
      total_payer:      resultat.total_payer,
      bureau_poste:  params.bureau_poste || 'COCODY',
      agent_nom:     params.agent_nom
    };

    const updated = await mettreAjourCalcul(id, updatedData);
    if (!updated) return { ok: false, error: 'Calcul introuvable' };
    return { ok: true, resultat: { ...resultat, ...updated } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Supprimer un calcul ──────────────────────────────────────────
ipcMain.handle('calculs-delete', async (event, id) => {
  try {
    await supprimerCalcul(id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Admin : statistiques ─────────────────────────────────────────
ipcMain.handle('admin-stats', async () => {
  try {
    const stats = await getAdminStats();
    return { ok: true, stats };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Admin : toutes les opérations ────────────────────────────────
ipcMain.handle('admin-operations', async () => {
  try {
    const operations = await listerCalculs({ limit: 1000, offset: 0 });
    return { ok: true, calculs: operations };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── IPC existants (inchangés) ───────────────────────────────────────

// Ouvrir un fichier PDF localement
ipcMain.handle('open-pdf', async (event, pdfPathOrUrl) => {
  try {
    if (pdfPathOrUrl.startsWith('http://') || pdfPathOrUrl.includes('/api/pdf/')) {
      const fileName = path.basename(pdfPathOrUrl);
      const fullPath = path.join(GENERATED_DIR, fileName);
      if (fs.existsSync(fullPath)) {
        await shell.openPath(fullPath);
        return { ok: true };
      }
    }
    if (fs.existsSync(pdfPathOrUrl)) {
      await shell.openPath(pdfPathOrUrl);
      return { ok: true };
    }
    return { ok: false, error: 'Fichier introuvable' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Imprimer le reçu (fenêtre dédiée avec dialogue Chromium) ────────
ipcMain.handle('print-receipt-html', async (event, { html, waybill }) => {
  return new Promise((resolve) => {
    let tempFilePath = null;
    try {
      const printWin = new BrowserWindow({
        show: false,
        width: 794,
        height: 1123,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      // Lire le CSS pour l'injecter dans la page reçu
      const cssPath = path.join(__dirname, 'frontend', 'static', 'css', 'style.css');
      let cssContent = '';
      try { cssContent = fs.readFileSync(cssPath, 'utf8'); } catch (e) { /* ignore */ }

      const logoPath = path.join(__dirname, 'frontend', 'static', 'img', 'laposte-logo.png');
      const logoBase64 = fs.existsSync(logoPath)
        ? 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
        : '';

      // Remplacer le chemin relatif du logo par le base64
      const htmlWithLogo = html.replace(/src="static\/img\/laposte-logo\.png"/g, `src="${logoBase64}"`);

      const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Reçu ${waybill || ''}</title>
  <style>
    :root {
      --green: #008000; --green-lite: #e8f5e9; --yellow: #FFD700;
      --white: #fff; --grey-line: #e0e0e0; --grey-bg: #f5f5f5;
      --text: #1a1a1a; --text-soft: #666; --radius: 8px;
      --shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; padding: 20px; color: var(--text); }
    ${cssContent}
    #receiptWrap { display: block !important; }
    .receipt-actions { display: none !important; }
    @media print {
      body { padding: 0; }
      #receiptWrap { display: block !important; }
      .receipt-actions { display: none !important; }
    }
  </style>
</head>
<body>
  ${htmlWithLogo}
</body>
</html>`;

      // Écrire dans un fichier temporaire (évite le crash du service réseau avec les data: URL longues)
      tempFilePath = path.join(GENERATED_DIR, `print_temp_${Date.now()}.html`);
      fs.writeFileSync(tempFilePath, fullHtml, 'utf8');

      printWin.loadFile(tempFilePath);

      const cleanup = () => {
        try { if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) { /* ignore */ }
        if (!printWin.isDestroyed()) printWin.close();
      };

      printWin.webContents.once('did-finish-load', () => {
        // Ouvrir le dialogue d'impression Chromium (avec prévisualisation native)
        printWin.webContents.print(
          { silent: false, printBackground: true, color: true },
          (success, errorType) => {
            if (!printWin.isDestroyed()) printWin.close();
            // 'cancelled' n'est pas une erreur — l'utilisateur a annulé
            resolve({ ok: success || errorType === 'cancelled' });
          }
        );
        // Résoudre immédiatement pour libérer le renderer (la fenêtre d'impression reste ouverte)
        resolve({ ok: true });
      });

      printWin.webContents.once('did-fail-load', () => {
        if (!printWin.isDestroyed()) printWin.close();
        resolve({ ok: false, error: 'Échec chargement du reçu' });
      });

    } catch (err) {
      console.error('Erreur print-receipt-html:', err.message);
      resolve({ ok: false, error: err.message });
    }
  });
});

// ── Générer PDF depuis le rendu HTML (identique à l'aperçu) ──────────
ipcMain.handle('print-to-pdf', async (event, waybill) => {
  try {
    if (!mainWindow) return { ok: false, error: 'Fenêtre non disponible' };

    const pdfBuffer = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        marginType: 'default'
      },
      printSelectionOnly: false,
      landscape: false
    });

    const fileName = `recu_${waybill || 'export'}_${Date.now()}.pdf`;
    const filePath = path.join(GENERATED_DIR, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    return { ok: true, filePath, fileName };
  } catch (err) {
    console.error('Erreur printToPDF:', err.message);
    return { ok: false, error: err.message };
  }
});

// ── Ouvrir boîte de dialogue Enregistrer PDF ─────────────────────────
ipcMain.handle('save-pdf-dialog', async (event, defaultName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer le reçu PDF',
      defaultPath: path.join(app.getPath('downloads'), defaultName || 'recu.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    return { ok: !result.canceled, filePath: result.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Copier un fichier ───────────────────────────────────────────────
ipcMain.handle('copy-file', async (event, src, dest) => {
  try {
    fs.copyFileSync(src, dest);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('parse-dhl-pdf-path', async (event, filePath) => {
  try {
    return await parseDhlReceipt(filePath);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Import PDF DHL ──────────────────────────────────────────────────
ipcMain.handle('import-dhl-pdf', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer un fichier ou une archive',
      filters: [
        { name: 'Documents', extensions: ['pdf', 'zip', 'rar'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Archives', extensions: ['zip', 'rar'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.zip' || ext === '.rar') {
      return { ok: true, isArchive: true, filePath };
    }

    const parseResult = await parseDhlReceipt(filePath);
    return parseResult;
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('list-archive-contents', async (event, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let pdfFiles = [];

    if (ext === '.zip') {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      zipEntries.forEach(entry => {
        if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.pdf')) {
          pdfFiles.push(entry.entryName);
        }
      });
    } else if (ext === '.rar') {
      const extractor = await createExtractorFromFile({ filepath: filePath });
      const list = extractor.getFileList();
      const fileHeaders = [...list.fileHeaders];
      fileHeaders.forEach(header => {
        if (!header.flags.directory && header.name.toLowerCase().endsWith('.pdf')) {
          pdfFiles.push(header.name);
        }
      });
    }
    
    return { ok: true, files: pdfFiles };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('extract-and-parse-archive-file', async (event, filePath, innerFileName) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'surtaxe-'));
    const tempFilePath = path.join(tempDir, path.basename(innerFileName));

    if (ext === '.zip') {
      const zip = new AdmZip(filePath);
      zip.extractEntryTo(innerFileName, tempDir, false, true);
    } else if (ext === '.rar') {
      const extractor = await createExtractorFromFile({ filepath: filePath, targetPath: tempDir });
      const extracted = extractor.extract({ files: [innerFileName] });
      const files = [...extracted.files]; // Load the files to disk
    }

    // Ensure the file exists
    const extractedFilePath = (ext === '.rar') ? path.join(tempDir, innerFileName) : tempFilePath;
    if (!fs.existsSync(extractedFilePath)) {
      throw new Error("L'extraction du fichier a échoué.");
    }

    const parseResult = await parseDhlReceipt(extractedFilePath);
    
    // Clean up
    fs.unlinkSync(extractedFilePath);
    
    return parseResult;
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Version ─────────────────────────────────────────────────────────
ipcMain.handle('get-version', () => {
  return require('./package.json').version;
});

// Forcer la fermeture propre de tout l'environnement à la sortie
app.on('window-all-closed', () => {
  app.quit();
  process.exit(0);
});

app.whenReady().then(() => {
  ensureDirs();
  initDb(); // Initialiser la base de données JSON locale (sans serveur HTTP)
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
