const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const _RAW_SUPABASE_URL = process.env.SUPABASE_URL || '';
// Accept either a full URL or a bare project ref (build the full URL from the ref).
const SUPABASE_URL = _RAW_SUPABASE_URL.startsWith('http')
  ? _RAW_SUPABASE_URL.replace(/\/+$/, '')
  : (_RAW_SUPABASE_URL ? 'https://' + _RAW_SUPABASE_URL + '.supabase.co' : '');
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 86400 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

exports.handler = async (event) => {
 try {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  if (!SUPABASE_URL || !SUPABASE_KEY || !JWT_SECRET) {
    console.error('signup misconfigured; missing env:',
      [['SUPABASE_URL', SUPABASE_URL], ['SUPABASE_KEY', SUPABASE_KEY], ['JWT_SECRET', JWT_SECRET]]
        .filter(([, v]) => !v).map(([k]) => k).join(', '));
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }

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

  // Check for existing email — surface DB errors loudly instead of treating them as "no user"
  const check = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id&limit=1`, { headers: H });
  if (!check.ok) { console.error('signup: users query failed:', await check.text()); return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) }; }
  const existing = await check.json();
  if (existing.length) return { statusCode: 409, body: JSON.stringify({ error: 'Email already registered' }) };

  const passwordHash = await bcrypt.hash(password, 10);

  // Create business
  const bizRes = await fetch(`${SUPABASE_URL}/rest/v1/businesses`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ name: business_name, plan: 'free' })
  });
  if (!bizRes.ok) { console.error('signup: business insert failed:', await bizRes.text()); return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) }; }
  const [biz] = await bizRes.json();
  // An insert blocked by RLS can still return 2xx with an empty body — catch that explicitly.
  if (!biz || !biz.id) { console.error('signup: business insert returned no row (RLS or key issue)'); return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) }; }

  // Create user
  const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ email: email.toLowerCase(), password_hash: passwordHash, name, business_id: biz.id, role: 'owner' })
  });
  if (!userRes.ok) { console.error('signup: user insert failed:', await userRes.text()); return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) }; }
  const [user] = await userRes.json();
  if (!user || !user.id) { console.error('signup: user insert returned no row'); return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) }; }

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
 } catch (err) {
  console.error('signup crashed:', err && err.stack);
  return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
 }
};
