// POST /api/auth/signup — create business + owner user, return JWT

const bcrypt = require('bcryptjs');
const jwt = require('../../../lib/jwt');
const db = require('../../../lib/supabase');
const { handler, created, badRequest, json } = require('../../../lib/http');

exports.handler = handler('POST', async (event, body) => {
  const email = (body.email || '').trim().toLowerCase();
  const { password, name, business_name } = body;

  if (!email || !password || !name || !business_name) return badRequest('Missing required fields');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return badRequest('Enter a valid email address');
  if (password.length < 8) return badRequest('Password must be at least 8 characters');

  const existing = await db.selectOne('users', `email=eq.${encodeURIComponent(email)}&select=id`);
  if (existing) return json(409, { error: 'Email already registered' });

  const password_hash = await bcrypt.hash(password, 10);

  const biz = await db.insert('businesses', { name: business_name.trim(), plan: 'free' });

  let user;
  try {
    user = await db.insert('users', {
      email,
      password_hash,
      name: name.trim(),
      business_id: biz.id,
      role: 'owner'
    });
  } catch (err) {
    // Don't leave an orphaned business behind if user creation fails.
    await db.remove('businesses', `id=eq.${biz.id}`).catch(() => {});
    throw err;
  }

  await db.update('businesses', `id=eq.${biz.id}`, { owner_id: user.id });

  return created({
    token: jwt.sign({ user_id: user.id, business_id: biz.id, role: 'owner' }),
    user_id: user.id,
    business_id: biz.id,
    role: 'owner',
    name: user.name,
    business_name: biz.name,
    plan: 'free',
    onboarded: false
  });
});
