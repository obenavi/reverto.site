// Market prices: returns the most-recent USDA market price per commodity.
// Reverto — usda_prices is GLOBAL market data (the neutral benchmark we compare
// invoice prices against), so there is NO business_id scoping here. A valid JWT
// is still required so this stays behind auth like every other app endpoint.
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
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/usda_prices?select=commodity,price_avg,price_low,price_high,unit,report_date&order=commodity.asc,report_date.desc`,
      { headers: H }
    );
    if (!res.ok) {
      console.error('market/prices fetch failed:', res.status, await res.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const rows = await res.json();

    // Rows arrive ordered by commodity asc, then report_date desc, so the first
    // row seen for each commodity is its most-recent price. Track the newest
    // report_date across all rows for the top-level `as_of`.
    const seen = new Set();
    const prices = [];
    let as_of = null;
    for (const row of rows) {
      if (row.report_date && (as_of == null || row.report_date > as_of)) as_of = row.report_date;
      if (seen.has(row.commodity)) continue;
      seen.add(row.commodity);
      prices.push({
        commodity: row.commodity,
        price_avg: row.price_avg,
        price_low: row.price_low,
        price_high: row.price_high,
        unit: row.unit,
        report_date: row.report_date,
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prices, as_of })
    };
  } catch (err) {
    console.error('market/prices error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
