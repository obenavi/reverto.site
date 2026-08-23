// HS256 JWT sign/verify — no external dependency

const crypto = require('crypto');

const TTL_SECONDS = 7 * 86400;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

function b64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function sign(payload, ttl = TTL_SECONDS) {
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ ...payload, iat: now, exp: now + ttl });
  const sig = crypto.createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verify(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [h, b, s] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(`${h}.${b}`).digest('base64url');

  // Constant-time compare; timingSafeEqual throws on length mismatch
  const a = Buffer.from(s);
  const e = Buffer.from(expected);
  if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;

  let payload;
  try { payload = JSON.parse(Buffer.from(b, 'base64url').toString()); }
  catch (_) { return null; }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// Reads the Authorization header (Netlify lowercases header names).
function fromEvent(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return verify(h.slice(7));
}

module.exports = { sign, verify, fromEvent, TTL_SECONDS };
