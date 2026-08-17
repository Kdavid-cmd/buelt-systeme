/**
 * backend/services/sessionService.js
 * Session simple par cookie signé (HMAC), sans base de données de sessions.
 * Un seul niveau d'accès : le cookie prouve juste "code d'accès valide", rien de plus.
 */
const crypto = require('crypto');

const COOKIE_NAME = 'buelt_session';
// Session glissante : 5 min d'inactivité -> reconnexion obligatoire. Chaque
// requête authentifiée (voir requireAuth) prolonge la session de 5 min, donc
// un agent actif ne se fait jamais déconnecter ; seule une vraie inactivité
// de 5 min ou plus invalide la session.
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 min

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
  // Session glissante : toute requête authentifiée repousse l'expiration de
  // 5 min supplémentaires — seule une inactivité réelle de 5 min expire la session.
  issueSessionCookie(res);
  next();
}

module.exports = { COOKIE_NAME, issueSessionCookie, clearSessionCookie, requireAuth };
