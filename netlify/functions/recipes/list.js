// Recipes list/detail — recipe costing (BOM). Reverto.
// Returns recipes with computed total_cost, cost_per_serving, and food_cost_pct.
// All data strictly scoped by business_id from the JWT.
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

// Compute cost metrics from a recipe row + its ingredient rows.
function computeCosts(recipe, ingredients) {
  let total_cost = 0;
  for (const ing of ingredients) {
    const qty = Number(ing.quantity);
    const uc = Number(ing.unit_cost);
    if (Number.isFinite(qty) && Number.isFinite(uc)) total_cost += qty * uc;
  }
  total_cost = Math.round(total_cost * 100) / 100;

  const yieldQty = Number(recipe.yield_qty);
  const cost_per_serving = (Number.isFinite(yieldQty) && yieldQty > 0)
    ? Math.round((total_cost / yieldQty) * 100) / 100
    : null;

  const menuPrice = Number(recipe.menu_price);
  const food_cost_pct = (Number.isFinite(menuPrice) && menuPrice > 0)
    ? Math.round((total_cost / menuPrice) * 100 * 10) / 10
    : null;

  return { total_cost, cost_per_serving, food_cost_pct };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
  const biz = payload.business_id;
  const recipe_id = event.queryStringParameters?.id;

  try {
    // Detail view — one recipe scoped by business_id, with its ingredients.
    if (recipe_id) {
      const recRes = await fetch(
        `${SUPABASE_URL}/rest/v1/recipes?id=eq.${encodeURIComponent(recipe_id)}&business_id=eq.${biz}&select=id,name,yield_qty,yield_unit,menu_price,notes,created_at&limit=1`,
        { headers: H }
      );
      if (!recRes.ok) {
        console.error('recipes/list detail fetch failed:', recRes.status, await recRes.text().catch(() => ''));
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
      }
      const recRows = await recRes.json();
      if (!Array.isArray(recRows) || !recRows.length) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Recipe not found' }) };
      }
      const recipe = recRows[0];

      const ingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/recipe_ingredients?recipe_id=eq.${encodeURIComponent(recipe_id)}&business_id=eq.${biz}&select=id,name,quantity,unit,unit_cost&order=created_at.asc`,
        { headers: H }
      );
      const ingredients = ingRes.ok ? await ingRes.json() : [];
      const metrics = computeCosts(recipe, ingredients);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe, ingredients, ...metrics }),
      };
    }

    // List view — all recipes for the business, with computed metrics.
    const recRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recipes?business_id=eq.${biz}&select=id,name,yield_qty,yield_unit,menu_price,notes,created_at&order=created_at.desc`,
      { headers: H }
    );
    if (!recRes.ok) {
      console.error('recipes/list list fetch failed:', recRes.status, await recRes.text().catch(() => ''));
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
    const recipes = await recRes.json();
    if (!Array.isArray(recipes) || !recipes.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipes: [] }) };
    }

    // Fetch ingredients for all recipes in one query, then group in JS.
    const ids = recipes.map((r) => r.id).filter(Boolean);
    const byRecipe = new Map();
    if (ids.length) {
      const inList = ids.map((id) => encodeURIComponent(id)).join(',');
      const ingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/recipe_ingredients?recipe_id=in.(${inList})&business_id=eq.${biz}&select=recipe_id,quantity,unit_cost`,
        { headers: H }
      );
      const ingredients = ingRes.ok ? await ingRes.json() : [];
      for (const ing of ingredients) {
        if (!byRecipe.has(ing.recipe_id)) byRecipe.set(ing.recipe_id, []);
        byRecipe.get(ing.recipe_id).push(ing);
      }
    }

    const withMetrics = recipes.map((r) => ({
      ...r,
      ...computeCosts(r, byRecipe.get(r.id) || []),
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipes: withMetrics }),
    };
  } catch (err) {
    console.error('recipes/list error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
