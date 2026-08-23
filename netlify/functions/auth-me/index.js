// GET /api/auth/me — current user + business, used to bootstrap the app shell

const jwt = require('../../../lib/jwt');
const db = require('../../../lib/supabase');
const { handler, ok, unauthorized, notFound } = require('../../../lib/http');

exports.handler = handler('GET', async (event) => {
  const auth = jwt.fromEvent(event);
  if (!auth) return unauthorized();

  const user = await db.selectOne('users', `id=eq.${auth.user_id}&select=id,email,name,role,business_id`);
  if (!user) return unauthorized();

  const biz = await db.selectOne(
    'businesses',
    `id=eq.${user.business_id}&select=id,name,plan,onboarded,city,state,cuisine_type,seats`
  );
  if (!biz) return notFound('Business not found');

  return ok({ user, business: biz });
});
