// Invoice approval — marks an invoice approved (or un-approved) for the
// authenticated business. Reverto. Strictly scoped by business_id from the JWT.
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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const invoice_id = body.invoice_id;
  if (!invoice_id || typeof invoice_id !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'invoice_id is required' }) };
  }

  // Default to approving; allow explicit un-approve via { approved: false }.
  const approved = body.approved === false ? false : true;

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
  const restH = { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

  try {
    // Verify the invoice belongs to the caller (scoped by business_id from JWT).
    const ownRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(invoice_id)}&business_id=eq.${payload.business_id}&select=id&limit=1`,
      { headers: H }
    );
    if (!ownRes.ok) {
      console.error('invoices/approve ownership fetch failed:', ownRes.status, await ownRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const ownRows = await ownRes.json();
    if (!Array.isArray(ownRows) || !ownRows.length) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };
    }

    const patch = approved
      ? { approved: true, approved_at: new Date().toISOString(), approved_by: payload.user_id }
      : { approved: false, approved_at: null, approved_by: null };

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(invoice_id)}&business_id=eq.${payload.business_id}`,
      { method: 'PATCH', headers: restH, body: JSON.stringify(patch) }
    );
    if (!res.ok) {
      console.error('invoices/approve patch failed:', res.status, await res.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const rows = await res.json();
    // A write blocked by RLS or matching no owned row returns 2xx with [].
    if (!Array.isArray(rows) || !rows.length || !rows[0].id) {
      console.error('invoices/approve returned no row (RLS, key issue, or not owned)');
      return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved,
        approved_at: rows[0].approved_at ?? null,
      }),
    };
  } catch (err) {
    console.error('invoices/approve error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
