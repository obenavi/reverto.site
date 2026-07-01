// Ingredient auto-cost — suggest an ingredient's unit cost from what THIS
// business actually paid on its parsed invoices. Reverto.
// invoice_items has no business_id, so we scope via the invoices we own and
// join by invoice_id (same pattern as alerts/price-changes).
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

const NOT_FOUND = { found: false, unit_cost: null, basis: null, vendor_name: null, last_date: null };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const name = (event.queryStringParameters?.name || '').trim();
  if (!name) return { statusCode: 400, body: JSON.stringify({ error: 'name is required' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
  const B = `${SUPABASE_URL}/rest/v1`;
  const biz = payload.business_id;

  try {
    // 1. This business's invoices (scoped by JWT business_id). Newest first so we
    //    can attach the most recent purchase date + vendor to each item.
    const invRes = await fetch(
      `${B}/invoices?business_id=eq.${biz}&select=id,invoice_date,vendor_name,created_at`,
      { headers: H }
    );
    if (!invRes.ok) {
      console.error('recipes/ingredient-cost invoices fetch failed:', invRes.status, await invRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const invoices = await invRes.json();
    if (!Array.isArray(invoices) || !invoices.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(NOT_FOUND) };
    }

    const invMap = new Map();
    for (const inv of invoices) {
      invMap.set(inv.id, {
        date: inv.invoice_date || inv.created_at || null,
        vendor_name: inv.vendor_name || null,
      });
    }

    // 2. Matching line items for those invoices. Case-insensitive substring match
    //    on description (PostgREST ilike; * are wildcards). Only rows that carry a
    //    usable cost basis are of interest.
    const ids = invoices.map((i) => i.id);
    const inList = ids.map((id) => encodeURIComponent(id)).join(',');
    const pattern = encodeURIComponent('*' + name + '*');
    const itemsRes = await fetch(
      `${B}/invoice_items?invoice_id=in.(${inList})&description=ilike.${pattern}&select=invoice_id,description,cost_per_lb,cost_per_oz,cost_per_each`,
      { headers: H }
    );
    if (!itemsRes.ok) {
      console.error('recipes/ingredient-cost items fetch failed:', itemsRes.status, await itemsRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const items = await itemsRes.json();
    if (!Array.isArray(items) || !items.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(NOT_FOUND) };
    }

    // 3. Pick the most recent purchase (by invoice date) that has a usable cost.
    //    Prefer cost_per_lb, then cost_per_oz, then cost_per_each.
    let best = null; // { date, vendor_name, unit_cost, basis }
    for (const it of items) {
      const meta = invMap.get(it.invoice_id);
      if (!meta || !meta.date) continue;

      let unit_cost = null, basis = null;
      if (it.cost_per_lb != null && Number.isFinite(Number(it.cost_per_lb))) {
        unit_cost = Number(it.cost_per_lb); basis = 'lb';
      } else if (it.cost_per_oz != null && Number.isFinite(Number(it.cost_per_oz))) {
        unit_cost = Number(it.cost_per_oz); basis = 'oz';
      } else if (it.cost_per_each != null && Number.isFinite(Number(it.cost_per_each))) {
        unit_cost = Number(it.cost_per_each); basis = 'each';
      } else {
        continue;
      }

      if (!best || String(meta.date) > String(best.date)) {
        best = { date: meta.date, vendor_name: meta.vendor_name, unit_cost, basis };
      }
    }

    if (!best) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(NOT_FOUND) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        found: true,
        unit_cost: best.unit_cost,
        basis: best.basis,
        vendor_name: best.vendor_name,
        last_date: best.date,
      }),
    };
  } catch (err) {
    console.error('recipes/ingredient-cost error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
