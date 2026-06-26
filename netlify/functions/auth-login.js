const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 86400 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let email, password;
  try { ({ email, password } = JSON.parse(event.body)); }
  catch (_) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  if (!email || !password) return { statusCode: 400, body: JSON.stringify({ error: 'Email and password required' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,business_id,role,name,password_hash&limit=1`,
    { headers: H }
  );
  if (!r.ok) return { statusCode: 500, body: JSON.stringify({ error: 'DB error' }) };

  const rows = await r.json();
  if (!rows.length) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };

  // Fetch plan from business
  const br = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${user.business_id}&select=plan&limit=1`, { headers: H });
  const biz = br.ok ? (await br.json())[0] : null;

  const token = makeJwt({ user_id: user.id, business_id: user.business_id, role: user.role });

  return {
    statusCode: 200,
    body: JSON.stringify({
      token,
      user_id: user.id,
      business_id: user.business_id,
      role: user.role,
      name: user.name,
      plan: biz?.plan || 'free'
    })
  };
};
