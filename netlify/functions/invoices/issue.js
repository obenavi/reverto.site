// Invoice issue reporting — records a reported problem (credit, refund, damaged,
// etc.) against an invoice for the authenticated business. Reverto. Strictly
// scoped by business_id from the JWT.
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

const ALLOWED_TYPES = ['credit', 'refund', 'damaged', 'not_delivered', 'wrong_item', 'other'];

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

  const invoice_id = body.invoice_id;
  if (!invoice_id || typeof invoice_id !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'invoice_id is required' }) };
  }

  const issue_type = cleanStr(body.issue_type);
  if (!issue_type || !ALLOWED_TYPES.includes(issue_type)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid issue type' }) };
  }

  // amount is optional; if present it must be a finite number.
  let amount = null;
  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    const n = Number(body.amount);
    if (!Number.isFinite(n)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid amount' }) };
    }
    amount = n;
  }

  const description = cleanStr(body.description);
  // invoice_item_id is optional context — accept a uuid-ish string, no hard verify.
  const invoice_item_id = cleanStr(body.invoice_item_id);

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
  const restH = { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

  try {
    // Verify the invoice belongs to the caller (scoped by business_id from JWT).
    const ownRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(invoice_id)}&business_id=eq.${payload.business_id}&select=id&limit=1`,
      { headers: H }
    );
    if (!ownRes.ok) {
      console.error('invoices/issue ownership fetch failed:', ownRes.status, await ownRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const ownRows = await ownRes.json();
    if (!Array.isArray(ownRows) || !ownRows.length) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };
    }

    const row = {
      invoice_id,
      business_id: payload.business_id,
      invoice_item_id,
      issue_type,
      amount,
      description,
      status: 'open',
      created_by: payload.user_id,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/invoice_issues`, {
      method: 'POST',
      headers: restH,
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      console.error('invoices/issue insert failed:', res.status, await res.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const rows = await res.json();
    // An insert blocked by RLS can return 2xx with an empty array — treat as failure.
    if (!Array.isArray(rows) || !rows.length || !rows[0].id) {
      console.error('invoices/issue returned no row (RLS or key issue)');
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: rows[0] }),
    };
  } catch (err) {
    console.error('invoices/issue error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
