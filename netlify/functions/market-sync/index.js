// POST /api/market/sync — daily USDA AMS price sync, triggered by GitHub Actions

const db = require('../../../lib/supabase');
const { handler, ok, unauthorized } = require('../../../lib/http');

const CRON_SECRET = process.env.CRON_SECRET;
const USDA_API_KEY = process.env.USDA_API_KEY;

// USDA AMS report IDs for relevant commodity groups
// Full list: https://mymarketnews.ams.usda.gov/filereader/public/reports
const USDA_REPORTS = [
  { id: '1254', label: 'NW Fruit & Vegetable' },
  { id: '1255', label: 'SW Fruit & Vegetable' },
  { id: '2457', label: 'National Chicken Parts' },
  { id: '2470', label: 'National Ground Beef' }
];

const BATCH_SIZE = 500;

exports.handler = handler('POST', async (event) => {
  if ((event.headers['x-cron-secret'] || '') !== CRON_SECRET) return unauthorized();

  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  const failed = [];

  for (const report of USDA_REPORTS) {
    try {
      const url = `https://marsapi.ams.usda.gov/services/v1.2/reports/${report.id}?api_key=${USDA_API_KEY}&q=report_date=${today}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) { failed.push(report.id); continue; }

      const data = await res.json();
      for (const item of (data.results || data || [])) {
        const low = parseFloat(item.low_price || item.price_min || 0);
        const high = parseFloat(item.high_price || item.price_max || 0);
        if (!low && !high) continue;

        const commodity = (item.commodity || item.item || '').toLowerCase().trim();
        if (!commodity) continue;

        rows.push({
          commodity,
          // grade/region are part of the unique key, so they must never be null
          grade: item.grade || '',
          region: item.office || report.label,
          unit: item.unit || item.package || 'lb',
          price_low: low || null,
          price_high: high || null,
          price_avg: low && high ? +((low + high) / 2).toFixed(4) : (low || high),
          report_date: item.report_date || today,
          source_api: `usda_ams_${report.id}`
        });
      }
    } catch (err) {
      console.error(`[market-sync] report ${report.id} failed:`, err.message);
      failed.push(report.id);
    }
  }

  if (!rows.length) return ok({ synced: 0, failed, note: 'No data from USDA today' });

  let synced = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.upsert('usda_prices', batch, 'commodity,grade,region,report_date');
    synced += batch.length;
  }

  return ok({ synced, failed, date: today });
});
