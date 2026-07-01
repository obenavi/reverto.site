// Payment forecast & vendor spend — upcoming payments (by vendor terms) and
// current-month spend breakdown. Reverto.
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

// Payment terms → days until due. Unknown/missing terms default to net30 (assumed).
const TERM_DAYS = {
  net7: 7,
  net15: 15,
  net30: 30,
  net60: 60,
  ewa: 7,
  cod: 0,
  prepaid: 0,
};

const DAY_MS = 86400000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  try {
    const [invRes, supRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/invoices?business_id=eq.${payload.business_id}&select=id,vendor_name,invoice_number,invoice_date,total_amount,status`,
        { headers: H }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/suppliers?business_id=eq.${payload.business_id}&select=name,payment_terms`,
        { headers: H }
      ),
    ]);

    if (!invRes.ok) {
      console.error('payments/forecast invoices fetch failed:', invRes.status, await invRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    if (!supRes.ok) {
      console.error('payments/forecast suppliers fetch failed:', supRes.status, await supRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }

    const invoices = await invRes.json();
    const suppliers = await supRes.json();

    // Case-insensitive, trimmed vendor_name → payment_terms map.
    const termsMap = new Map();
    for (const s of suppliers) {
      const key = (s.name || '').trim().toLowerCase();
      if (!key) continue;
      termsMap.set(key, (s.payment_terms || '').trim().toLowerCase());
    }

    const now = new Date();
    // Midnight (local server) for whole-day due-date math.
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    const upcoming = [];
    const spendByVendor = new Map();
    let total_owed = 0;
    let total_spend_month = 0;

    for (const inv of invoices) {
      const amount = Number(inv.total_amount) || 0;
      const isPaid = inv.status === 'paid';

      // Vendor spend breakdown — current calendar month by invoice_date.
      const dateStr = typeof inv.invoice_date === 'string' ? inv.invoice_date : '';
      if (dateStr.slice(0, 7) === ym) {
        const vname = (inv.vendor_name || '').trim() || 'Unknown vendor';
        spendByVendor.set(vname, (spendByVendor.get(vname) || 0) + amount);
        total_spend_month += amount;
      }

      // Owed / upcoming — only unpaid invoices.
      if (isPaid) continue;
      total_owed += amount;

      // Upcoming payment needs a parseable invoice_date.
      const invMs = Date.parse(dateStr);
      if (!dateStr || Number.isNaN(invMs)) continue;

      const supTerms = termsMap.get((inv.vendor_name || '').trim().toLowerCase());
      let terms = supTerms;
      let assumed = false;
      if (!terms || !(terms in TERM_DAYS)) {
        terms = 'net30';
        assumed = true;
      }
      const termDays = TERM_DAYS[terms];

      const dueMs = invMs + termDays * DAY_MS;
      const dueDate = new Date(dueMs).toISOString().slice(0, 10);
      const days_until_due = Math.round((dueMs - todayMs) / DAY_MS);

      upcoming.push({
        vendor_name: inv.vendor_name || 'Unknown vendor',
        invoice_id: inv.id,
        invoice_number: inv.invoice_number || null,
        invoice_date: dateStr.slice(0, 10),
        due_date: dueDate,
        days_until_due,
        amount,
        terms,
        assumed,
      });
    }

    upcoming.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));

    const vendor_spend = Array.from(spendByVendor.entries())
      .map(([vendor_name, total]) => ({ vendor_name, total }))
      .sort((a, b) => b.total - a.total);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upcoming,
        vendor_spend,
        total_owed,
        total_spend_month,
        currency: 'USD',
      }),
    };
  } catch (err) {
    console.error('payments/forecast error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
