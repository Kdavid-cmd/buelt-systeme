/**
 * backend/routes/import.js
 * POST /api/import/dhl        → upload d'un PDF (ou d'une archive zip/rar) de reçu DHL
 * POST /api/import/dhl/entry  → extraire et analyser un fichier précis d'une archive déjà envoyée
 *
 * Réutilise exactement la même logique que l'import Electron/IPC de main.js
 * (backend/services/pdfParserService.js + adm-zip / node-unrar-js), simplement
 * exposée en HTTP pour que l'écran web "Importer un reçu DHL" fonctionne sans Electron.
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { createExtractorFromFile } = require('node-unrar-js');
const { parseDhlReceipt } = require('../services/pdfParserService');
const logger = require('../services/loggerService');

const UPLOAD_DIR = path.join(os.tmpdir(), 'buelt-uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
  }),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// ── Upload d'un fichier (PDF direct, ou archive zip/rar à explorer) ──
router.post('/dhl', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Aucun fichier reçu' });

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    if (ext === '.zip' || ext === '.rar') {
      let files = [];
      if (ext === '.zip') {
        const zip = new AdmZip(filePath);
        files = zip.getEntries()
          .filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'))
          .map(e => e.entryName);
      } else {
        const extractor = await createExtractorFromFile({ filepath: filePath });
        const list = extractor.getFileList();
        files = [...list.fileHeaders]
          .filter(h => !h.flags.directory && h.name.toLowerCase().endsWith('.pdf'))
          .map(h => h.name);
      }
      // On garde l'archive sur disque (nécessaire pour l'extraction) ; jeton = nom du fichier stocké.
      return res.json({ ok: true, isArchive: true, archiveToken: path.basename(filePath), files });
    }

    // PDF (ou image — parseDhlReceipt ne gère que le texte PDF pour l'instant)
    const parseResult = await parseDhlReceipt(filePath);
    fs.unlink(filePath, () => {});
    res.json(parseResult);
  } catch (err) {
    logger.error('Erreur import DHL:', err.message);
    fs.unlink(filePath, () => {});
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Extraire et analyser un fichier précis d'une archive déjà envoyée ──
router.post('/dhl/entry', async (req, res) => {
  try {
    const { archiveToken, innerFileName } = req.body || {};
    if (!archiveToken || !innerFileName) {
      return res.status(400).json({ ok: false, error: 'archiveToken et innerFileName requis' });
    }

    const archivePath = path.join(UPLOAD_DIR, path.basename(archiveToken)); // anti path-traversal
    if (!fs.existsSync(archivePath)) {
      return res.status(404).json({ ok: false, error: 'Archive introuvable ou expirée, veuillez la renvoyer' });
    }

    const ext = path.extname(archivePath).toLowerCase();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buelt-extract-'));
    let extractedFilePath = path.join(tempDir, path.basename(innerFileName));

    if (ext === '.zip') {
      const zip = new AdmZip(archivePath);
      zip.extractEntryTo(innerFileName, tempDir, false, true);
    } else if (ext === '.rar') {
      const extractor = await createExtractorFromFile({ filepath: archivePath, targetPath: tempDir });
      const extracted = extractor.extract({ files: [innerFileName] });
      [...extracted.files]; // force l'écriture sur disque
      extractedFilePath = path.join(tempDir, innerFileName);
    }

    if (!fs.existsSync(extractedFilePath)) {
      throw new Error("L'extraction du fichier a échoué.");
    }

    const parseResult = await parseDhlReceipt(extractedFilePath);
    fs.unlink(extractedFilePath, () => {});
    res.json(parseResult);
  } catch (err) {
    logger.error('Erreur extraction archive:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
