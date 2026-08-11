/**
 * backend/services/sessionService.js
 * Session simple par cookie signé (HMAC), sans base de données de sessions.
 * Un seul niveau d'accès : le cookie prouve juste "code d'accès valide", rien de plus.
 */
const crypto = require('crypto');

const COOKIE_NAME = 'buelt_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function getSecret() {
  return process.env.SESSION_SECRET || process.env.ACCESS_CODE || 'buelt-dev-secret';
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadObj) {
  const payload = base64url(JSON.stringify(payloadObj));
  const hmac = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${hmac}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, hmac] = token.split('.');
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  const a = Buffer.from(hmac || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function issueSessionCookie(res) {
  const token = sign({ exp: Date.now() + SESSION_TTL_MS });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_TTL_MS
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const session = verify(token);
  if (!session) {
    return res.status(401).json({ ok: false, error: 'Non authentifié' });
  }
  next();
}

module.exports = { COOKIE_NAME, issueSessionCookie, clearSessionCookie, requireAuth };
