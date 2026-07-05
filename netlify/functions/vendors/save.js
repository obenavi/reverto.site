// Vendor save — create or update a supplier row scoped by business_id from the
// JWT. Reverto. Lays groundwork for the Payment Forecast feature (payment_terms).
const crypto = require('crypto');

const _RAW_SUPABASE_URL = process.env.SUPABASE_URL || '';
// Accept either a full URL or a bare project ref (build the full URL from the ref).
const SUPABASE_URL = _RAW_SUPABASE_URL.startsWith('http')
  ? _RAW_SUPABASE_URL.replace(/\/+$/, '')
  : (_RAW_SUPABASE_URL ? 'https://' + _RAW_SUPABASE_URL + '.supabase.co' : '');
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

function verifyJwt(authHeader) {
  try {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    if (header.alg !== 'HS256') return null;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
    const sigBuf = Buffer.from(s);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

const ALLOWED_TERMS = ['net7', 'net15', 'net30', 'net60', 'cod', 'ewa', 'prepaid'];

function cleanStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const name = cleanStr(body.name);
  if (!name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Vendor name is required' }) };
  }

  const payment_terms = cleanStr(body.payment_terms);
  if (!payment_terms || !ALLOWED_TERMS.includes(payment_terms)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payment terms' }) };
  }

  const row = {
    name,
    payment_terms,
    rep_name: cleanStr(body.rep_name),
    rep_phone: cleanStr(body.rep_phone),
    rep_email: cleanStr(body.rep_email),
    notes: cleanStr(body.notes),
  };

  const H = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  const id = cleanStr(body.id);

  try {
    let res;
    if (id) {
      // Update — scoped by business_id so a user can't edit another tenant's vendor.
      res = await fetch(
        `${SUPABASE_URL}/rest/v1/suppliers?id=eq.${encodeURIComponent(id)}&business_id=eq.${payload.business_id}`,
        { method: 'PATCH', headers: H, body: JSON.stringify(row) }
      );
    } else {
      res = await fetch(`${SUPABASE_URL}/rest/v1/suppliers`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify({ ...row, business_id: payload.business_id }),
      });
    }

    if (!res.ok) {
      console.error('vendors/save write failed:', res.status, await res.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }

    const rows = await res.json();
    // A write blocked by RLS (or an update that matched no owned row) can return
    // 2xx with an empty array — treat that as not-found / failure explicitly.
    if (!Array.isArray(rows) || !rows.length || !rows[0].id) {
      console.error('vendors/save returned no row (RLS, key issue, or vendor not owned)');
      return { statusCode: id ? 404 : 500, body: JSON.stringify({ error: id ? 'Vendor not found' : 'Server error' }) };
    }

    return {
      statusCode: id ? 200 : 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved: true, vendor: rows[0] }),
    };
  } catch (err) {
    console.error('vendors/save error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
