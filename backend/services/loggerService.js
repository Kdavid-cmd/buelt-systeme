/**
 * backend/services/loggerService.js
 * Logger Winston pour logs applicatifs
 */
const path = require('path');
const fs = require('fs');

const LOGS_DIR = (global.APP_PATHS && global.APP_PATHS.LOGS_DIR) || path.resolve(path.join(__dirname, '..', '..', 'logs'));
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

let logger;

try {
  const winston = require('winston');
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message }) =>
        `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: path.join(LOGS_DIR, 'app.log'),
        maxsize: 5 * 1024 * 1024, // 5 MB
        maxFiles: 3,
        tailable: true
      })
    ]
  });
} catch {
  // Fallback si winston non disponible
  logger = {
    info:  (...args) => console.log('[INFO]', ...args),
    warn:  (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args)
  };
}

module.exports = logger;
