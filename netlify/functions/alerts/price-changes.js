// Price-change alerts: detect items whose purchase price changed between the
// two most recent times this business bought them. Reverto.
// All data scoped by business_id from the JWT. invoice_items has no
// business_id, so we scope via the invoices we own and join by invoice_id.
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

// Stable grouping key for an item: prefer the supplier item code, else a
// normalized description (lowercased, trimmed, whitespace collapsed).
function itemKey(item) {
  const code = (item.supplier_item_code || '').trim();
  if (code) return 'code:' + code.toLowerCase();
  const desc = (item.description || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return desc ? 'desc:' + desc : null;
}

const MAX_ALERTS = 20;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  try {
    // 1. This business's invoices (scoped by JWT business_id).
    const invRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?business_id=eq.${payload.business_id}&select=id,invoice_date,vendor_name,created_at&order=invoice_date.desc`,
      { headers: H }
    );
    if (!invRes.ok) {
      console.error('alerts/price-changes invoices fetch failed:', invRes.status, await invRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const invoices = await invRes.json();
    if (!invoices.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alerts: [] }) };
    }

    // Map invoice_id -> { date, vendor }. Date falls back to created_at.
    const invMap = new Map();
    for (const inv of invoices) {
      invMap.set(inv.id, {
        date: inv.invoice_date || inv.created_at || null,
        vendor_name: inv.vendor_name || null,
      });
    }

    // 2. Line items for those invoices. Encode ids for the PostgREST in.() list.
    const ids = invoices.map((i) => i.id);
    const inList = ids.map((id) => encodeURIComponent(id)).join(',');
    const itemsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoice_items?invoice_id=in.(${inList})&select=invoice_id,supplier_item_code,description,cost_per_lb,unit_price`,
      { headers: H }
    );
    if (!itemsRes.ok) {
      console.error('alerts/price-changes items fetch failed:', itemsRes.status, await itemsRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const items = await itemsRes.json();

    // 3. Group by stable key, attaching each purchase's date + vendor.
    const groups = new Map();
    for (const it of items) {
      const key = itemKey(it);
      if (!key) continue;
      const meta = invMap.get(it.invoice_id);
      if (!meta || !meta.date) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({
        date: meta.date,
        vendor_name: meta.vendor_name,
        description: it.description || '',
        cost_per_lb: it.cost_per_lb,
        unit_price: it.unit_price,
      });
    }

    const alerts = [];
    for (const purchases of groups.values()) {
      // Newest first by date.
      purchases.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

      // Need at least two DISTINCT purchase dates (ignore same-day repurchases;
      // we treat the first-seen row for the newest distinct date as canonical).
      const distinct = [];
      const seenDates = new Set();
      for (const p of purchases) {
        const day = String(p.date).slice(0, 10);
        if (seenDates.has(day)) continue;
        seenDates.add(day);
        distinct.push(p);
        if (distinct.length === 2) break;
      }
      if (distinct.length < 2) continue;

      const curr = distinct[0];
      const prev = distinct[1];

      // Price basis: only compare like-for-like units. Prefer cost_per_lb when
      // BOTH sides have it, else fall back to unit_price when both have it.
      let currPrice = null, prevPrice = null, basis = null;
      if (curr.cost_per_lb != null && prev.cost_per_lb != null) {
        currPrice = Number(curr.cost_per_lb);
        prevPrice = Number(prev.cost_per_lb);
        basis = 'lb';
      } else if (curr.unit_price != null && prev.unit_price != null) {
        currPrice = Number(curr.unit_price);
        prevPrice = Number(prev.unit_price);
        basis = 'case';
      } else {
        continue; // mixed/absent units — skip rather than compare apples to oranges
      }

      if (!Number.isFinite(currPrice) || !Number.isFinite(prevPrice)) continue;
      if (!prevPrice) continue; // prev 0/null — pct undefined

      const pct_change = Math.round(((currPrice - prevPrice) / prevPrice) * 100 * 10) / 10;
      if (pct_change === 0) continue; // no meaningful change

      alerts.push({
        description: curr.description || prev.description || 'Item',
        vendor_name: curr.vendor_name,
        prev_price: prevPrice,
        curr_price: currPrice,
        pct_change,
        direction: pct_change > 0 ? 'up' : 'down',
        basis,
        last_date: curr.date,
      });
    }

    alerts.sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts: alerts.slice(0, MAX_ALERTS) }),
    };
  } catch (err) {
    console.error('alerts/price-changes error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
