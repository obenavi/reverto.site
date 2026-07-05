// Recipe save — create or update a recipe AND replace its ingredient set.
// Reverto. All rows scoped by business_id from the JWT.
//
// NOTE (no transaction): Supabase REST has no multi-statement transaction, so
// the recipe write, the ingredient delete, and the ingredient insert happen as
// separate requests. On a mid-sequence failure the recipe row may persist while
// its ingredients are partially replaced. We order writes to minimize harm
// (recipe first, then delete-then-insert ingredients) and report failures, but
// callers should be aware there is no atomic rollback.
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

function cleanStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Parse a numeric field; returns null when absent/blank/unparseable.
function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const name = cleanStr(body.name);
  if (!name) return { statusCode: 400, body: JSON.stringify({ error: 'Recipe name is required' }) };

  const biz = payload.business_id;
  const id = cleanStr(body.id);

  // Normalize ingredient rows. Each needs a name; quantity/unit_cost default to 0.
  const rawIngredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  const ingredients = rawIngredients
    .map((r) => ({
      name: cleanStr(r && r.name),
      quantity: num(r && r.quantity),
      unit: cleanStr(r && r.unit),
      unit_cost: num(r && r.unit_cost),
    }))
    .filter((r) => r.name); // drop nameless rows

  const recipeRow = {
    name,
    yield_qty: num(body.yield_qty),
    yield_unit: cleanStr(body.yield_unit),
    menu_price: num(body.menu_price),
    notes: cleanStr(body.notes),
  };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
  const writeH = { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
  const B = `${SUPABASE_URL}/rest/v1`;

  try {
    let recipeId = id;

    if (id) {
      // Update — scoped by business_id so a user can't edit another tenant's recipe.
      const res = await fetch(
        `${B}/recipes?id=eq.${encodeURIComponent(id)}&business_id=eq.${biz}`,
        { method: 'PATCH', headers: writeH, body: JSON.stringify(recipeRow) }
      );
      if (!res.ok) {
        console.error('recipes/save update failed:', res.status, await res.text().catch(() => ''));
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
      }
      const rows = await res.json();
      // A write blocked by RLS or an update matching no owned row returns 2xx []
      // — treat as not-found explicitly.
      if (!Array.isArray(rows) || !rows.length || !rows[0].id) {
        console.error('recipes/save update returned no row (not owned or RLS)');
        return { statusCode: 404, body: JSON.stringify({ error: 'Recipe not found' }) };
      }
      recipeId = rows[0].id;

      // Replace ingredients: delete existing, then insert the new set.
      const delRes = await fetch(
        `${B}/recipe_ingredients?recipe_id=eq.${encodeURIComponent(recipeId)}&business_id=eq.${biz}`,
        { method: 'DELETE', headers: H }
      );
      if (!delRes.ok) {
        console.error('recipes/save ingredient delete failed:', delRes.status, await delRes.text().catch(() => ''));
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
      }
    } else {
      // Create — business_id from the JWT, never the client.
      const res = await fetch(`${B}/recipes`, {
        method: 'POST',
        headers: writeH,
        body: JSON.stringify({ ...recipeRow, business_id: biz }),
      });
      if (!res.ok) {
        console.error('recipes/save insert failed:', res.status, await res.text().catch(() => ''));
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
      }
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length || !rows[0].id) {
        console.error('recipes/save insert returned no row (RLS or key issue)');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
      }
      recipeId = rows[0].id;
    }

    // Insert the new ingredient set (each stamped with business_id + recipe_id).
    if (ingredients.length) {
      const toInsert = ingredients.map((ing) => ({
        recipe_id: recipeId,
        business_id: biz,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        unit_cost: ing.unit_cost,
      }));
      const insRes = await fetch(`${B}/recipe_ingredients`, {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify(toInsert),
      });
      if (!insRes.ok) {
        console.error('recipes/save ingredient insert failed:', insRes.status, await insRes.text().catch(() => ''));
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
      }
    }

    return {
      statusCode: id ? 200 : 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved: true, id: recipeId }),
    };
  } catch (err) {
    console.error('recipes/save error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
