// CCPA "right to delete" — permanently deletes all data for the authenticated
// business: storage objects, invoice items (via cascade), invoices, daily sales,
// locations, suppliers, users, and the business row itself. Strictly scoped by
// business_id from the JWT. Requires an explicit confirmation in the body.
const crypto = require('crypto');

const _RAW_SUPABASE_URL = process.env.SUPABASE_URL || '';
// Accept either a full URL or a bare project ref (build the full URL from the ref).
const SUPABASE_URL = _RAW_SUPABASE_URL.startsWith('http')
  ? _RAW_SUPABASE_URL.replace(/\/+$/, '')
  : (_RAW_SUPABASE_URL ? 'https://' + _RAW_SUPABASE_URL + '.supabase.co' : '');
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const BUCKET = 'invoices';

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

  // Require an explicit confirmation so accidental requests can't wipe an account.
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (_) { body = {}; }
  if (body.confirm !== 'DELETE') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Confirmation required' }) };
  }

  const biz = payload.business_id;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
  const restH = { ...H, 'Content-Type': 'application/json' };
  const B = `${SUPABASE_URL}/rest/v1`;

  try {
    // 1. Collect this business's invoices first (need their storage paths before
    //    we delete the rows). Scoped strictly by business_id.
    const invRes = await fetch(`${B}/invoices?business_id=eq.${biz}&select=id,raw_file_url`, { headers: H });
    if (!invRes.ok) throw new Error('invoices fetch failed: ' + invRes.status);
    const invoices = await invRes.json();

    // 2. Delete storage objects under this business's prefix. We delete the known
    //    raw_file_url paths individually (each path begins with {business_id}/...).
    for (const inv of invoices) {
      if (!inv.raw_file_url) continue;
      try {
        const objRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${inv.raw_file_url}`,
          { method: 'DELETE', headers: H }
        );
        if (!objRes.ok && objRes.status !== 404) {
          console.error('data/delete storage delete non-ok:', objRes.status);
        }
      } catch (e) {
        console.error('data/delete storage delete error:', e);
      }
    }

    // 3. Write an audit record BEFORE deleting the business (audit_log has no FK in
    //    the live schema, so it survives the cascade).
    try {
      await fetch(`${B}/audit_log`, {
        method: 'POST',
        headers: restH,
        body: JSON.stringify({
          user_id: payload.user_id,
          business_id: biz,
          action: 'data_delete',
          details: { invoices_deleted: invoices.length },
          ip: (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
        }),
      });
    } catch (e) {
      console.error('data/delete audit_log write error:', e);
    }

    // 4. Delete DB rows in FK-safe order. Deleting invoices cascades invoice_items
    //    (invoice_items.invoice_id ... ON DELETE CASCADE). All other tables that
    //    reference businesses (daily_sales, locations, suppliers, item_master,
    //    subscriptions) are NO ACTION, so they must be deleted before the business row.
    const del = async (path) => {
      const res = await fetch(`${B}/${path}`, { method: 'DELETE', headers: H });
      if (!res.ok) throw new Error(`delete ${path} failed: ${res.status}`);
    };

    // push_subscriptions is scoped by user_id (no business_id column), so collect
    // this business's user ids first and clear their push subscriptions too.
    const usersRes = await fetch(`${B}/users?business_id=eq.${biz}&select=id`, { headers: H });
    const userIds = usersRes.ok ? (await usersRes.json()).map((u) => u.id) : [];

    // invoice_issues also carries business_id; deleting invoices cascades these
    // (FK ON DELETE CASCADE), but delete explicitly first as belt-and-suspenders.
    await del(`invoice_issues?business_id=eq.${biz}`);
    await del(`invoices?business_id=eq.${biz}`);
    await del(`daily_sales?business_id=eq.${biz}`);
    await del(`locations?business_id=eq.${biz}`);
    await del(`suppliers?business_id=eq.${biz}`);
    await del(`item_master?business_id=eq.${biz}`);
    await del(`subscriptions?business_id=eq.${biz}`);
    if (userIds.length) await del(`push_subscriptions?user_id=in.(${userIds.join(',')})`);
    // Recipe costing rows carry business_id but have no businesses FK cascade, so
    // delete them explicitly before the business row. recipe_ingredients has a
    // recipe_id FK ON DELETE CASCADE, but we delete it first as belt-and-suspenders.
    await del(`recipe_ingredients?business_id=eq.${biz}`);
    await del(`recipes?business_id=eq.${biz}`);
    await del(`users?business_id=eq.${biz}`);
    await del(`businesses?id=eq.${biz}`);

    return { statusCode: 200, body: JSON.stringify({ deleted: true }) };
  } catch (err) {
    console.error('data/delete error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
