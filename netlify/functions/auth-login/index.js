// POST /api/auth/login — verify credentials, return JWT

const bcrypt = require('bcryptjs');
const jwt = require('../../../lib/jwt');
const db = require('../../../lib/supabase');
const { handler, ok, badRequest, unauthorized } = require('../../../lib/http');

exports.handler = handler('POST', async (event, body) => {
  const { email, password } = body;
  if (!email || !password) return badRequest('Email and password required');

  const user = await db.selectOne(
    'users',
    `email=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=id,business_id,role,name,password_hash`
  );

  // Same response for unknown email and wrong password — no account enumeration.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return unauthorized('Invalid email or password');
  }

  const biz = await db.selectOne('businesses', `id=eq.${user.business_id}&select=name,plan,onboarded`);

  await db.insert('audit_log', {
    user_id: user.id,
    business_id: user.business_id,
    action: 'login',
    ip: event.headers['x-nf-client-connection-ip'] || null
  }, { returning: false }).catch(() => {});

  return ok({
    token: jwt.sign({ user_id: user.id, business_id: user.business_id, role: user.role }),
    user_id: user.id,
    business_id: user.business_id,
    role: user.role,
    name: user.name,
    business_name: biz?.name || '',
    plan: biz?.plan || 'free',
    onboarded: !!biz?.onboarded
  });
});
