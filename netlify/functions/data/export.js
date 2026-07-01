// CCPA "right to know / access" — exports all data for the authenticated
// business as a downloadable JSON file. Strictly scoped by business_id from the
// JWT; never includes other tenants' data, password hashes, or secrets.
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

async function getJson(H, url) {
  const res = await fetch(url, { headers: H });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const biz = payload.business_id;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
  const B = `${SUPABASE_URL}/rest/v1`;

  try {
    // Business row (scoped by id).
    const businesses = await getJson(H, `${B}/businesses?id=eq.${biz}&select=*`);

    // Users for this business — explicitly select columns, never password_hash.
    const users = await getJson(H,
      `${B}/users?business_id=eq.${biz}&select=id,business_id,email,role,name,phone,notification_prefs,working_days,created_at`);

    // Invoices for this business.
    const invoices = await getJson(H, `${B}/invoices?business_id=eq.${biz}&select=*`);

    // Invoice items — joined via this business's invoice ids only.
    let invoice_items = [];
    const invoiceIds = invoices.map(i => i.id).filter(Boolean);
    if (invoiceIds.length) {
      const inList = invoiceIds.map(encodeURIComponent).join(',');
      invoice_items = await getJson(H, `${B}/invoice_items?invoice_id=in.(${inList})&select=*`);
    }

    // Reported invoice issues for this business (scoped by business_id).
    const invoice_issues = await getJson(H, `${B}/invoice_issues?business_id=eq.${biz}&select=*`);

    const daily_sales = await getJson(H, `${B}/daily_sales?business_id=eq.${biz}&select=*`);
    const locations = await getJson(H, `${B}/locations?business_id=eq.${biz}&select=*`);
    const suppliers = await getJson(H, `${B}/suppliers?business_id=eq.${biz}&select=*`);
    const item_master = await getJson(H, `${B}/item_master?business_id=eq.${biz}&select=*`);

    // Recipe costing (BOM) data for this business.
    const recipes = await getJson(H, `${B}/recipes?business_id=eq.${biz}&select=*`);
    const recipe_ingredients = await getJson(H, `${B}/recipe_ingredients?business_id=eq.${biz}&select=*`);

    const exportPayload = {
      export_generated_at: new Date().toISOString(),
      business_id: biz,
      business: businesses[0] || null,
      users,
      invoices,
      invoice_items,
      invoice_issues,
      daily_sales,
      locations,
      suppliers,
      item_master,
      recipes,
      recipe_ingredients,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="reverto-data-export.json"',
      },
      body: JSON.stringify(exportPayload, null, 2),
    };
  } catch (err) {
    console.error('data/export error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
