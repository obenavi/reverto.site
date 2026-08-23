// POST /api/invoices/parse — Azure Document Intelligence → supplier parser → DB

const jwt = require('../../../lib/jwt');
const db = require('../../../lib/supabase');
const { handler, ok, unauthorized, badRequest, notFound, json } = require('../../../lib/http');
const { parseSysco } = require('../../../parsers/sysco');
const { parseGeneric } = require('../../../parsers/generic');

const AZURE_DI_ENDPOINT = process.env.AZURE_DI_ENDPOINT;
const AZURE_DI_KEY = process.env.AZURE_DI_KEY;

// PostgREST rejects a bulk insert unless every object has an identical key set,
// and the parsers emit different keys per line (catch-weight vs. case-priced,
// fuel surcharge only when the invoice carries one). Normalize to fixed columns.
const ITEM_COLUMNS = [
  'supplier_item_code', 'description', 'common_name', 'category', 'brand', 'pack_size',
  'catch_weight', 'quantity', 'unit', 'unit_price', 'extended_price',
  'units_per_case', 'unit_size_oz', 'total_oz_per_case', 'actual_weight_lb',
  'cost_per_case', 'cost_per_lb', 'cost_per_oz', 'cost_per_each',
  'fuel_surcharge', 'split_case_surcharge'
];

const NUMERIC_DEFAULTS = { fuel_surcharge: 0, split_case_surcharge: 0 };

function toRow(item, invoice_id) {
  const row = { invoice_id };
  for (const col of ITEM_COLUMNS) {
    const v = item[col];
    row[col] = v === undefined ? (NUMERIC_DEFAULTS[col] ?? null) : v;
  }
  row.catch_weight = !!item.catch_weight;
  return row;
}

const POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 2000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function analyze(fileBuffer, contentType) {
  const res = await fetch(
    `${AZURE_DI_ENDPOINT}/formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31`,
    {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': AZURE_DI_KEY, 'Content-Type': contentType },
      body: fileBuffer
    }
  );
  if (!res.ok) throw new Error(`Azure DI rejected the document: ${await res.text()}`);

  const operationUrl = res.headers.get('operation-location');
  if (!operationUrl) throw new Error('Azure DI returned no operation-location header');

  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await fetch(operationUrl, { headers: { 'Ocp-Apim-Subscription-Key': AZURE_DI_KEY } });
    const data = await poll.json();
    if (data.status === 'succeeded') return data.analyzeResult;
    if (data.status === 'failed') throw new Error('Azure DI analysis failed');
  }
  throw new Error('Azure DI timed out');
}

exports.handler = handler('POST', async (event, body) => {
  const auth = jwt.fromEvent(event);
  if (!auth) return unauthorized();

  const { invoice_id, file_url } = body;
  if (!invoice_id || !file_url) return badRequest('invoice_id and file_url required');

  const invoice = await db.selectOne(
    'invoices',
    `id=eq.${invoice_id}&business_id=eq.${auth.business_id}&select=id,supplier_id`
  );
  if (!invoice) return notFound('Invoice not found');

  const fileRes = await fetch(file_url, { headers: { 'Authorization': 'Bearer ' + db.SUPABASE_KEY } });
  if (!fileRes.ok) return badRequest('Cannot fetch invoice file');
  const contentType = fileRes.headers.get('content-type') || 'application/pdf';
  const fileBuffer = await fileRes.arrayBuffer();

  let result;
  try {
    result = await analyze(fileBuffer, contentType);
  } catch (err) {
    await db.update('invoices', `id=eq.${invoice_id}`, { status: 'failed', parse_error: err.message });
    return json(502, { error: 'Invoice parsing failed', detail: err.message });
  }

  const doc = result.documents?.[0]?.fields || {};
  const vendorName = doc.VendorName?.content || '';
  const items = /sysco/i.test(vendorName) ? parseSysco(result) : parseGeneric(result);

  if (items.length) {
    await db.insert('invoice_items', items.map(i => toRow(i, invoice_id)), { returning: false });
  }

  await db.update('invoices', `id=eq.${invoice_id}`, {
    status: 'verified',
    invoice_number: doc.InvoiceId?.content || null,
    invoice_date: doc.InvoiceDate?.valueDate || null,
    total_amount: doc.InvoiceTotal?.valueCurrency?.amount ?? null,
    parse_error: null,
    parsed_at: new Date().toISOString()
  });

  return ok({ parsed: items.length, vendor: vendorName });
});
