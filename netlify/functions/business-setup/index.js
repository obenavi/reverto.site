// POST /api/business/setup — save onboarding details (business, first location, supplier)

const jwt = require('../../../lib/jwt');
const db = require('../../../lib/supabase');
const { handler, ok, unauthorized, badRequest, json } = require('../../../lib/http');

const TERMS = ['net7', 'net15', 'net30', 'cod', 'ewa'];

exports.handler = handler('POST', async (event, body) => {
  const auth = jwt.fromEvent(event);
  if (!auth) return unauthorized();
  if (auth.role !== 'owner') return json(403, { error: 'Only the owner can complete setup' });

  const { business = {}, location = {}, supplier = {} } = body;

  if (!location.name) return badRequest('Location name required');
  if (supplier.payment_terms && !TERMS.includes(supplier.payment_terms)) {
    return badRequest('Invalid payment terms');
  }

  const biz = await db.update('businesses', `id=eq.${auth.business_id}`, {
    address: business.address || null,
    city: business.city || null,
    state: business.state || 'CA',
    zip: business.zip || null,
    phone: business.phone || null,
    cuisine_type: business.cuisine_type || null,
    seats: business.seats ? parseInt(business.seats, 10) : null,
    onboarded: true
  });

  // Onboarding is re-runnable: reuse the location/supplier rows if they exist.
  const existingLoc = await db.selectOne('locations', `business_id=eq.${auth.business_id}&select=id`);
  const loc = existingLoc
    ? await db.update('locations', `id=eq.${existingLoc.id}`, {
        name: location.name,
        address: location.address || null,
        city: location.city || business.city || null
      })
    : await db.insert('locations', {
        business_id: auth.business_id,
        name: location.name,
        address: location.address || null,
        city: location.city || business.city || null
      });

  let sup = null;
  if (supplier.name) {
    const existingSup = await db.selectOne(
      'suppliers',
      `business_id=eq.${auth.business_id}&name=eq.${encodeURIComponent(supplier.name)}&select=id`
    );
    const fields = {
      name: supplier.name,
      rep_name: supplier.rep_name || null,
      rep_phone: supplier.rep_phone || null,
      rep_email: supplier.rep_email || null,
      payment_terms: supplier.payment_terms || 'net30'
    };
    sup = existingSup
      ? await db.update('suppliers', `id=eq.${existingSup.id}`, fields)
      : await db.insert('suppliers', { business_id: auth.business_id, ...fields });
  }

  await db.insert('audit_log', {
    user_id: auth.user_id,
    business_id: auth.business_id,
    action: 'business_setup',
    details: { location_id: loc?.id, supplier_id: sup?.id }
  }, { returning: false }).catch(() => {});

  return ok({ business: biz, location: loc, supplier: sup });
});
