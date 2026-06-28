// Invoice upload: accepts a base64-encoded file from the browser, stores it in Supabase
// Storage, creates a pending `invoices` row, then hands off to invoices/parse.js for OCR.
//
// IMPORTANT: requires a Supabase Storage bucket named "invoices" to already exist
// (public or with a policy allowing the service key to read/write). This function does not
// create the bucket — that must be done once in the Supabase dashboard.
//
// NOTE on schema: written against docs/ARCHITECTURE.md's `invoices` table
// (business_id, location_id, supplier_id, status, raw_file_url, ...). `location_id` and
// `supplier_id` are left null here since onboarding/supplier-setup don't exist yet — verify
// these columns are actually nullable in the live Supabase project (see
// docs/business/product-backlog.md "open questions for engineer").

const crypto = require('crypto');

const _RAW_SUPABASE_URL = process.env.SUPABASE_URL || '';
// Accept either a full URL or a bare project ref (build the full URL from the ref).
const SUPABASE_URL = _RAW_SUPABASE_URL.startsWith('http')
  ? _RAW_SUPABASE_URL.replace(/\/+$/, '')
  : (_RAW_SUPABASE_URL ? 'https://' + _RAW_SUPABASE_URL + '.supabase.co' : '');
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const BUCKET = 'invoices';

// Same inline verify pattern as invoices/parse.js (no shared auth lib in this codebase).
function verifyJwt(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const [h, b, s] = token.split('.');
  if (!h || !b || !s) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  if (expected !== s) return null;
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (payload.exp < Date.now() / 1000) return null;
  return payload;
}

// Map a few common upload mime types to file extensions for the storage path.
const EXT_BY_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch (_) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { filename, content_type, data } = body;
  if (!filename || !content_type || !data) {
    return { statusCode: 400, body: JSON.stringify({ error: 'filename, content_type, and data (base64) are required' }) };
  }

  const rawExt = (EXT_BY_MIME[content_type] || (filename.split('.').pop() || 'bin')).toLowerCase();
  const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'bin';

  // ~8M base64 chars decodes to ~6MB, Netlify's Lambda-backed request body limit.
  if (data.length > 8_000_000) {
    return { statusCode: 413, body: JSON.stringify({ error: 'File too large (max ~6MB)' }) };
  }

  let fileBuffer;
  try {
    fileBuffer = Buffer.from(data, 'base64');
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: 'data must be base64-encoded' }) };
  }
  if (!fileBuffer.length) return { statusCode: 400, body: JSON.stringify({ error: 'Empty file' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  // 1. Create the invoices row first (status: pending) so we have an id for the storage path.
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      business_id: payload.business_id,
      status: 'pending'
    })
  });
  if (!insertRes.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create invoice record', detail: await insertRes.text() }) };
  }
  const [invoice] = await insertRes.json();
  const invoiceId = invoice.id;

  // 2. Upload file to Supabase Storage at {business_id}/{invoice_id}.{ext}
  const storagePath = `${payload.business_id}/${invoiceId}.${ext}`;
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': content_type,
      'x-upsert': 'true'
    },
    body: fileBuffer
  });
  if (!uploadRes.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to upload file to storage', detail: await uploadRes.text() }) };
  }

  // 3. Record the storage path on the invoice row.
  await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoiceId}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ raw_file_url: storagePath })
  });

  // 4. Hand off to invoices/parse.js (invoked in-process — no shared HTTP layer for internal
  // calls in this codebase, so we call the handler directly with the same JWT payload).
  let parseResult;
  try {
    const { handler: parseHandler } = require('./parse');
    const parseEvent = {
      httpMethod: 'POST',
      headers: { authorization: event.headers['authorization'] },
      body: JSON.stringify({ invoice_id: invoiceId })
    };
    const parseRes = await parseHandler(parseEvent);
    parseResult = { statusCode: parseRes.statusCode, ...JSON.parse(parseRes.body) };
  } catch (err) {
    // Upload succeeded even if parsing failed/errored — surface that distinction to the client.
    return {
      statusCode: 200,
      body: JSON.stringify({
        invoice_id: invoiceId,
        uploaded: true,
        parsed: false,
        error: 'Upload succeeded but parsing failed: ' + err.message
      })
    };
  }

  if (parseResult.statusCode && parseResult.statusCode !== 200) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        invoice_id: invoiceId,
        uploaded: true,
        parsed: false,
        error: parseResult.error || 'Parsing failed'
      })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      invoice_id: invoiceId,
      uploaded: true,
      parsed: parseResult.parsed,
      vendor: parseResult.vendor
    })
  };
};
