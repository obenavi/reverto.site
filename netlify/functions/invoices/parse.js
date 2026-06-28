// Invoice parsing: calls Azure Document Intelligence, routes to supplier parser
const crypto = require('crypto');

const _RAW_SUPABASE_URL = process.env.SUPABASE_URL || '';
// Accept either a full URL or a bare project ref (build the full URL from the ref).
const SUPABASE_URL = _RAW_SUPABASE_URL.startsWith('http')
  ? _RAW_SUPABASE_URL.replace(/\/+$/, '')
  : (_RAW_SUPABASE_URL ? 'https://' + _RAW_SUPABASE_URL + '.supabase.co' : '');
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const AZURE_DI_ENDPOINT = process.env.AZURE_DI_ENDPOINT;
const AZURE_DI_KEY = process.env.AZURE_DI_KEY;

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch (_) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { invoice_id } = body;
  if (!invoice_id) return { statusCode: 400, body: JSON.stringify({ error: 'invoice_id required' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  // Fetch invoice row to verify ownership and get the storage path (never trust a client-supplied file_url)
  const invRes = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice_id}&business_id=eq.${payload.business_id}&select=id,supplier_id,raw_file_url&limit=1`, { headers: H });
  const invRows = invRes.ok ? await invRes.json() : [];
  if (!invRows.length) return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };

  const rawFileUrl = invRows[0].raw_file_url;
  if (!rawFileUrl || !rawFileUrl.startsWith(`${payload.business_id}/`)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invoice has no associated file' }) };
  }
  const fileUrl = `${SUPABASE_URL}/storage/v1/object/invoices/${rawFileUrl}`;

  // Download file from Supabase Storage
  const fileRes = await fetch(fileUrl, { headers: { 'Authorization': 'Bearer ' + SUPABASE_KEY } });
  if (!fileRes.ok) return { statusCode: 500, body: JSON.stringify({ error: 'Cannot fetch file' }) };
  const fileBuffer = await fileRes.arrayBuffer();

  // Call Azure Document Intelligence (prebuilt-invoice model)
  const analyzeRes = await fetch(
    `${AZURE_DI_ENDPOINT}/formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31`,
    {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': AZURE_DI_KEY, 'Content-Type': fileRes.headers.get('content-type') || 'application/pdf' },
      body: fileBuffer
    }
  );

  if (!analyzeRes.ok) return { statusCode: 500, body: JSON.stringify({ error: 'Azure DI error', detail: await analyzeRes.text() }) };

  const operationUrl = analyzeRes.headers.get('operation-location');
  if (!operationUrl) return { statusCode: 500, body: JSON.stringify({ error: 'No operation URL from Azure' }) };

  // Poll for result (Azure DI is async)
  let result = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(operationUrl, { headers: { 'Ocp-Apim-Subscription-Key': AZURE_DI_KEY } });
    const pollData = await pollRes.json();
    if (pollData.status === 'succeeded') { result = pollData.analyzeResult; break; }
    if (pollData.status === 'failed') return { statusCode: 500, body: JSON.stringify({ error: 'Azure DI analysis failed' }) };
  }
  if (!result) return { statusCode: 504, body: JSON.stringify({ error: 'Azure DI timeout' }) };

  // Identify supplier and route to parser
  const vendorName = result.documents?.[0]?.fields?.VendorName?.content || '';
  let parsedItems;
  if (/sysco/i.test(vendorName)) {
    const { parseSysco } = require('../../parsers/sysco');
    parsedItems = parseSysco(result);
  } else {
    const { parseGeneric } = require('../../parsers/generic');
    parsedItems = parseGeneric(result);
  }

  // Store parsed items
  if (parsedItems.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/invoice_items`, {
      method: 'POST',
      headers: { ...H, 'Prefer': 'return=minimal' },
      body: JSON.stringify(parsedItems.map(i => ({ ...i, invoice_id })))
    });
  }

  // Update invoice status + metadata
  const doc = result.documents?.[0]?.fields || {};
  await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice_id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({
      status: 'verified',
      vendor_name: vendorName || null,
      invoice_number: doc.InvoiceId?.content || null,
      invoice_date: doc.InvoiceDate?.valueDate || null,
      total_amount: doc.InvoiceTotal?.valueCurrency?.amount || null,
      parsed_at: new Date().toISOString()
    })
  });

  return { statusCode: 200, body: JSON.stringify({ parsed: parsedItems.length, vendor: vendorName }) };
};
