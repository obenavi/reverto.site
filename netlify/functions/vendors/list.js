// Vendors list — returns the business's vendors (suppliers) plus vendor names
// seen on invoices that have no matching supplier yet. Reverto.
// Scoped by business_id from the JWT (never trust the client).
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  try {
    const vendorsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/suppliers?business_id=eq.${payload.business_id}&select=id,name,rep_name,rep_phone,rep_email,payment_terms,notes&order=name.asc`,
      { headers: H }
    );
    if (!vendorsRes.ok) {
      console.error('vendors/list vendors fetch failed:', vendorsRes.status, await vendorsRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const vendors = await vendorsRes.json();

    // Distinct vendor_names seen on this business's invoices with no matching
    // supplier name yet (case-insensitive). Diffed in JS.
    let suggested_from_invoices = [];
    const invRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?business_id=eq.${payload.business_id}&select=vendor_name`,
      { headers: H }
    );
    if (invRes.ok) {
      const invoices = await invRes.json();
      const known = new Set(vendors.map(v => (v.name || '').trim().toLowerCase()).filter(Boolean));
      const seen = new Set();
      for (const row of invoices) {
        const raw = (row.vendor_name || '').trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        if (known.has(key) || seen.has(key)) continue;
        seen.add(key);
        suggested_from_invoices.push(raw);
      }
      suggested_from_invoices.sort((a, b) => a.localeCompare(b));
    } else {
      console.error('vendors/list invoices fetch failed:', invRes.status, await invRes.text().catch(() => ''));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendors, suggested_from_invoices })
    };
  } catch (err) {
    console.error('vendors/list error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
