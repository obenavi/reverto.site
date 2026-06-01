// Daily USDA AMS market price sync — triggered by GitHub Actions

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const USDA_API_KEY = process.env.USDA_API_KEY;

// USDA AMS report IDs for relevant commodity groups
// Full list: https://mymarketnews.ams.usda.gov/filereader/public/reports
const USDA_REPORTS = [
  { id: '1254', label: 'NW Fruit & Vegetable' },
  { id: '1255', label: 'SW Fruit & Vegetable' },
  { id: '2457', label: 'National Chicken Parts' },
  { id: '2470', label: 'National Ground Beef' },
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const secret = event.headers['x-cron-secret'] || '';
  if (secret !== CRON_SECRET) return { statusCode: 401, body: 'Unauthorized' };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' };

  const today = new Date().toISOString().slice(0, 10);
  const rows = [];

  for (const report of USDA_REPORTS) {
    try {
      const url = `https://marsapi.ams.usda.gov/services/v1.2/reports/${report.id}?api_key=${USDA_API_KEY}&q=report_date=${today}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) continue;

      const data = await res.json();
      const results = data.results || data || [];

      for (const item of results) {
        const low = parseFloat(item.low_price || item.price_min || 0);
        const high = parseFloat(item.high_price || item.price_max || 0);
        if (!low && !high) continue;

        rows.push({
          commodity: (item.commodity || item.item || '').toLowerCase().trim(),
          grade: item.grade || null,
          region: item.office || report.label,
          unit: item.unit || item.package || 'lb',
          price_low: low || null,
          price_high: high || null,
          price_avg: low && high ? +((low + high) / 2).toFixed(4) : (low || high),
          report_date: item.report_date || today,
          source_api: `usda_ams_${report.id}`
        });
      }
    } catch (_) {
      // Continue to next report on error
    }
  }

  if (!rows.length) {
    return { statusCode: 200, body: JSON.stringify({ synced: 0, note: 'No data from USDA today' }) };
  }

  // Batch upsert (Supabase accepts up to 1000 rows per request)
  const batchSize = 500;
  let synced = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usda_prices`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify(batch)
    });
    if (r.ok) synced += batch.length;
  }

  return { statusCode: 200, body: JSON.stringify({ synced, date: today }) };
};
