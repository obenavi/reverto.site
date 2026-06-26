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

  let body;
  try { body = JSON.parse(event.body); }
  catch (_) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { email, password, name, business_name } = body;
  if (!email || !password || !name || !business_name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }
  if (password.length < 8) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
  }

  const H = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // Check for existing email
  const check = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id&limit=1`, { headers: H });
  const existing = check.ok ? await check.json() : [];
  if (existing.length) return { statusCode: 409, body: JSON.stringify({ error: 'Email already registered' }) };

  const passwordHash = await bcrypt.hash(password, 10);

  // Create business
  const bizRes = await fetch(`${SUPABASE_URL}/rest/v1/businesses`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ name: business_name, plan: 'free' })
  });
  if (!bizRes.ok) return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create business' }) };
  const [biz] = await bizRes.json();

  // Create user
  const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ email: email.toLowerCase(), password_hash: passwordHash, name, business_id: biz.id, role: 'owner' })
  });
  if (!userRes.ok) return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create user' }) };
  const [user] = await userRes.json();

  // Update business owner_id
  await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${biz.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ owner_id: user.id })
  });

  const token = makeJwt({ user_id: user.id, business_id: biz.id, role: 'owner' });

  return {
    statusCode: 201,
    body: JSON.stringify({ token, user_id: user.id, business_id: biz.id, role: 'owner', name, plan: 'free' })
  };
};
