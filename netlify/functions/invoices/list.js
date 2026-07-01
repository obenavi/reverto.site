// Invoice list/detail: returns invoice header + line items for a given invoice_id
// Reverto — extends items with USDA market price comparisons
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

// Maps lowercased description substrings to USDA commodity keys.
// Checked in order — first match wins.
const COMMODITY_MAP = [
  { keywords: ['chicken breast'],    commodity: 'CHICKEN BREAST' },
  { keywords: ['chicken'],           commodity: 'CHICKEN BREAST' },
  { keywords: ['beef tenderloin', 'filet'], commodity: 'BEEF TENDERLOIN' },
  { keywords: ['ground beef', 'beef ground', 'chuck'], commodity: 'GROUND BEEF' },
  { keywords: ['atlantic salmon', 'salmon'], commodity: 'SALMON' },
  { keywords: ['shrimp'],            commodity: 'SHRIMP' },
  { keywords: ['tomato'],            commodity: 'TOMATOES' },
  { keywords: ['romaine', 'lettuce'], commodity: 'LETTUCE ROMAINE' },
  { keywords: ['onion'],             commodity: 'ONIONS' },
  { keywords: ['potato'],            commodity: 'POTATOES' },
  { keywords: ['avocado'],           commodity: 'AVOCADOS' },
  { keywords: ['apple'],             commodity: 'APPLES' },
  { keywords: ['cheese mozzarella', 'mozzarella'], commodity: 'MOZZARELLA' },
  { keywords: ['cheese cheddar', 'cheddar'], commodity: 'CHEDDAR CHEESE' },
  { keywords: ['butter'],            commodity: 'BUTTER' },
  { keywords: ['eggs', 'egg'],       commodity: 'EGGS' },
];

// --- v1 USDA-only benchmark helpers --------------------------------------
// Spec: docs/business/data-strategy.md
//   - USDA recency: report > 21 days old is "stale" (Section A.2 / A.7).
//   - Verdict thresholds (Section A.7):
//       below      <= -3%
//       at         <  5%
//       above      < 15%
//       well_above >= 15%
//   - Confidence (Section B.3): v1 is USDA-only, so the peer-based "High"
//     case is unreachable. We derive a 3-bucket confidence from USDA report
//     recency: fresh (<=21d) => high; stale up to 60d => medium; >60d => low.

const USDA_STALE_DAYS = 21;
const USDA_LOW_CONF_DAYS = 60;

// Whole-day difference between two YYYY-MM-DD(ish) dates. Returns null if
// either date is unparseable. Uses UTC to avoid TZ drift.
function daysBetween(laterIso, earlierIso) {
  const later = Date.parse(laterIso);
  const earlier = Date.parse(earlierIso);
  if (Number.isNaN(later) || Number.isNaN(earlier)) return null;
  return Math.floor((later - earlier) / 86400000);
}

// Reference date for recency = the invoice date if present, else today.
function benchmarkConfidence(ageDays) {
  if (ageDays == null) return 'low';
  if (ageDays <= USDA_STALE_DAYS) return 'high';
  if (ageDays <= USDA_LOW_CONF_DAYS) return 'medium';
  return 'low';
}

function benchmarkVerdict(variance_pct) {
  if (variance_pct == null) return null;
  const d = variance_pct / 100;
  if (d <= -0.03) return 'below';
  if (d < 0.05) return 'at';
  if (d < 0.15) return 'above';
  return 'well_above';
}

function matchCommodity(description) {
  const lower = (description || '').toLowerCase();
  for (const entry of COMMODITY_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) return entry.commodity;
    }
  }
  return null;
}

async function fetchUsdaPrice(H, commodity) {
  const encoded = encodeURIComponent(commodity);
  const url = `${SUPABASE_URL}/rest/v1/usda_prices?commodity=eq.${encoded}&select=commodity,price_avg,price_low,price_high,report_date&order=report_date.desc&limit=1`;
  const res = await fetch(url, { headers: H });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.length ? rows[0] : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  const invoice_id = event.queryStringParameters?.id;

  // No id => return the list of this business's invoices (scoped by JWT business_id).
  if (!invoice_id) {
    try {
      const listRes = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?business_id=eq.${payload.business_id}&select=id,vendor_name,invoice_number,invoice_date,total_amount,status,approved,created_at&order=created_at.desc`,
        { headers: H }
      );
      if (!listRes.ok) {
        console.error('invoices/list list fetch failed:', listRes.status, await listRes.text().catch(() => ''));
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
      }
      const invoices = await listRes.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices })
      };
    } catch (err) {
      console.error('invoices/list list error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
  }

  // Fetch invoice row, scoped by business_id from JWT (never trust client)
  const invRes = await fetch(
    `${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice_id}&business_id=eq.${payload.business_id}&select=id,vendor_name,invoice_number,invoice_date,total_amount,status,approved,approved_at,parsed_at,created_at&limit=1`,
    { headers: H }
  );
  const invRows = invRes.ok ? await invRes.json() : [];
  if (!invRows.length) return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };

  // Fetch line items
  const itemsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.${invoice_id}&select=id,description,category,pack_size,quantity,unit,unit_price,extended_price,cost_per_lb,cost_per_oz,cost_per_each,fuel_surcharge,split_case_surcharge&order=extended_price.desc`,
    { headers: H }
  );
  const items = itemsRes.ok ? await itemsRes.json() : [];

  // Fetch reported issues for this invoice (already scoped: invoice ownership
  // was verified above by the business_id-scoped invoice fetch).
  const issuesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/invoice_issues?invoice_id=eq.${invoice_id}&select=id,issue_type,amount,description,status,invoice_item_id,created_at&order=created_at.desc`,
    { headers: H }
  );
  const issues = issuesRes.ok ? await issuesRes.json() : [];

  // Look up USDA prices in parallel for all items that match a known commodity.
  // usda_prices is global market data — no business_id filter needed.
  const commodityCache = new Map(); // avoid duplicate fetches for same commodity
  const usdaLookups = items.map(item => {
    const commodity = matchCommodity(item.description);
    if (!commodity) return Promise.resolve(null);
    if (!commodityCache.has(commodity)) {
      commodityCache.set(commodity, fetchUsdaPrice(H, commodity));
    }
    return commodityCache.get(commodity);
  });

  const usdaResults = await Promise.all(usdaLookups);

  const itemsWithUsda = items.map((item, i) => {
    const usda = usdaResults[i];
    if (!usda) {
      return {
        ...item,
        usda_price_avg: null,
        usda_price_low: null,
        usda_price_high: null,
        usda_report_date: null,
        variance_pct: null,
        // v1 benchmark fields — null when there is no USDA match.
        benchmark_label: null,
        benchmark_confidence: null,
        benchmark_age_days: null,
        verdict: null,
      };
    }
    let variance_pct = null;
    if (item.cost_per_lb != null && usda.price_avg != null && usda.price_avg !== 0) {
      variance_pct = Math.round(((item.cost_per_lb - usda.price_avg) / usda.price_avg) * 100 * 10) / 10;
    }
    // Recency relative to the invoice date when known, else today.
    const refDate = invRows[0].invoice_date || new Date().toISOString();
    const ageDays = usda.report_date ? daysBetween(refDate, usda.report_date) : null;
    return {
      ...item,
      usda_price_avg: usda.price_avg,
      usda_price_low: usda.price_low,
      usda_price_high: usda.price_high,
      usda_report_date: usda.report_date,
      variance_pct,
      // v1 is USDA-only — reserved peer/blend labels are NOT used here.
      benchmark_label: 'USDA market price',
      benchmark_confidence: benchmarkConfidence(ageDays),
      benchmark_age_days: ageDays != null && ageDays >= 0 ? ageDays : null,
      verdict: benchmarkVerdict(variance_pct),
    };
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice: invRows[0], items: itemsWithUsda, issues })
  };
};
