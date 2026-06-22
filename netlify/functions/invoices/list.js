// Invoice list/detail: returns invoice header + line items for a given invoice_id
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

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
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const invoice_id = event.queryStringParameters?.id;
  if (!invoice_id) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  // Fetch invoice row, scoped by business_id from JWT (never trust client)
  const invRes = await fetch(
    `${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice_id}&business_id=eq.${payload.business_id}&select=id,invoice_number,invoice_date,total_amount,status,parsed_at,created_at&limit=1`,
    { headers: H }
  );
  const invRows = invRes.ok ? await invRes.json() : [];
  if (!invRows.length) return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };

  // Fetch line items
  const itemsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.${invoice_id}&select=description,category,pack_size,quantity,unit,unit_price,extended_price,cost_per_lb,cost_per_oz,cost_per_each,fuel_surcharge,split_case_surcharge&order=extended_price.desc`,
    { headers: H }
  );
  const items = itemsRes.ok ? await itemsRes.json() : [];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice: invRows[0], items })
  };
};
