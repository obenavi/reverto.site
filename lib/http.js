// Shared HTTP helpers for Netlify Functions

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.SITE_URL || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
};

function json(statusCode, payload) {
  return { statusCode, headers: CORS, body: JSON.stringify(payload) };
}

const ok = (payload) => json(200, payload);
const created = (payload) => json(201, payload);
const badRequest = (msg) => json(400, { error: msg });
const unauthorized = (msg = 'Unauthorized') => json(401, { error: msg });
const notFound = (msg = 'Not found') => json(404, { error: msg });
const serverError = (msg = 'Server error') => json(500, { error: msg });

// Wraps a handler: CORS preflight, method allowlist, JSON body parse, error catch.
function handler(methods, fn) {
  const allowed = Array.isArray(methods) ? methods : [methods];
  return async (event, context) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
    if (!allowed.includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });

    let body = {};
    if (event.body) {
      try { body = JSON.parse(event.body); }
      catch (_) { return badRequest('Invalid JSON'); }
    }

    try {
      return await fn(event, body, context);
    } catch (err) {
      console.error('[function error]', err);
      return serverError();
    }
  };
}

module.exports = { json, ok, created, badRequest, unauthorized, notFound, serverError, handler, CORS };
