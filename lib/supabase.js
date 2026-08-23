// Thin Supabase PostgREST client for Netlify Functions

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function headers(extra = {}) {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers)
  });

  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (_) { data = text; } }

  if (!res.ok) {
    const detail = typeof data === 'object' && data ? (data.message || data.hint || JSON.stringify(data)) : data;
    const err = new Error(`Supabase ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const select = (table, query = '') => request(`${table}?${query}`);

async function selectOne(table, query) {
  const rows = await select(table, `${query}&limit=1`);
  return rows?.[0] || null;
}

async function insert(table, rows, { returning = true } = {}) {
  const data = await request(table, {
    method: 'POST',
    headers: { 'Prefer': returning ? 'return=representation' : 'return=minimal' },
    body: JSON.stringify(rows)
  });
  return Array.isArray(rows) ? data : data?.[0];
}

async function upsert(table, rows, onConflict) {
  return request(`${table}${onConflict ? `?on_conflict=${onConflict}` : ''}`, {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
}

async function update(table, query, patch) {
  const data = await request(`${table}?${query}`, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(patch)
  });
  return data?.[0] || null;
}

const remove = (table, query) => request(`${table}?${query}`, {
  method: 'DELETE',
  headers: { 'Prefer': 'return=minimal' }
});

module.exports = { request, select, selectOne, insert, upsert, update, remove, headers, SUPABASE_URL, SUPABASE_KEY };
