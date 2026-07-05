// Food cost % report — sums daily_sales and invoices in a date range,
// both scoped by business_id. Reverto.
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

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const q = event.queryStringParameters || {};
  let to = q.to;
  let from = q.from;

  const today = new Date();
  if (!to || !DATE_RE.test(to)) to = isoDate(today);
  if (!from || !DATE_RE.test(from)) {
    const d = new Date(to + 'T12:00:00');
    d.setDate(d.getDate() - 29);
    from = isoDate(d);
  }
  // Ensure from <= to
  if (from > to) { const t = from; from = to; to = t; }

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  try {
    const biz = payload.business_id;

    const salesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/daily_sales?business_id=eq.${biz}` +
      `&report_date=gte.${from}&report_date=lte.${to}` +
      `&select=report_date,net_sales&order=report_date.asc`,
      { headers: H }
    );
    if (!salesRes.ok) throw new Error('daily_sales fetch failed: ' + salesRes.status);
    const salesRows = await salesRes.json();

    const invRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?business_id=eq.${biz}` +
      `&invoice_date=gte.${from}&invoice_date=lte.${to}` +
      `&select=invoice_date,total_amount`,
      { headers: H }
    );
    if (!invRes.ok) throw new Error('invoices fetch failed: ' + invRes.status);
    const invRows = await invRes.json();

    // Group invoice cost by date.
    const costByDate = {};
    let total_food_cost = 0;
    for (const r of invRows) {
      const amt = Number(r.total_amount) || 0;
      total_food_cost += amt;
      if (r.invoice_date) costByDate[r.invoice_date] = (costByDate[r.invoice_date] || 0) + amt;
    }

    // Build per-day breakdown from sales rows, attaching same-day invoice cost.
    let total_sales = 0;
    const days = salesRows.map((r) => {
      const net = Number(r.net_sales) || 0;
      total_sales += net;
      const food_cost = costByDate[r.report_date] || 0;
      const pct = net > 0 ? Math.round((food_cost / net) * 100 * 10) / 10 : null;
      return { report_date: r.report_date, net_sales: net, food_cost, pct };
    });

    const food_cost_pct = total_sales > 0
      ? Math.round((total_food_cost / total_sales) * 100 * 10) / 10
      : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, total_sales, total_food_cost, food_cost_pct, days }),
    };
  } catch (err) {
    console.error('sales/report error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
