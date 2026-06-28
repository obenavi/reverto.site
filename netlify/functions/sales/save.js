// Daily sales entry — UPSERT into daily_sales scoped by business_id.
// Reverto. Ensures a default location exists for the business.
const crypto = require('crypto');

const _RAW_SUPABASE_URL = process.env.SUPABASE_URL || '';
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toNum(v, def) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const report_date = body.report_date;
  if (!report_date || !DATE_RE.test(report_date) || isNaN(new Date(report_date + 'T12:00:00').getTime())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid report_date (YYYY-MM-DD) required' }) };
  }

  const net_sales = toNum(body.net_sales, undefined);
  if (net_sales === undefined || isNaN(net_sales) || net_sales < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'net_sales (number >= 0) required' }) };
  }

  const tax = toNum(body.tax, 0);
  const tips = toNum(body.tips, 0);
  const covers = toNum(body.covers, 0);
  if ([tax, tips, covers].some(Number.isNaN) || tax < 0 || tips < 0 || covers < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'tax, tips, covers must be non-negative numbers' }) };
  }

  const H = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
  };

  try {
    // Ensure a default location exists for this business.
    const locRes = await fetch(
      `${SUPABASE_URL}/rest/v1/locations?business_id=eq.${payload.business_id}&select=id&limit=1`,
      { headers: H }
    );
    if (!locRes.ok) throw new Error('location lookup failed: ' + locRes.status);
    let locRows = await locRes.json();

    let location_id;
    if (locRows.length) {
      location_id = locRows[0].id;
    } else {
      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/locations`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'return=representation' },
        body: JSON.stringify({ business_id: payload.business_id, name: 'Main Location' }),
      });
      if (!createRes.ok) throw new Error('location create failed: ' + createRes.status);
      const created = await createRes.json();
      location_id = created[0].id;
    }

    // UPSERT daily_sales on (location_id, report_date) unique constraint.
    const upRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_sales`, {
      method: 'POST',
      headers: { ...H, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        business_id: payload.business_id,
        location_id,
        report_date,
        net_sales,
        tax,
        tips,
        covers,
        entered_by: payload.user_id,
      }),
    });
    if (!upRes.ok) throw new Error('daily_sales upsert failed: ' + upRes.status + ' ' + (await upRes.text()));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved: true, report_date }),
    };
  } catch (err) {
    console.error('sales/save error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
