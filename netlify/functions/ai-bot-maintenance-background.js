const { runMaintenance, json, MAINTENANCE_VERSION } = require('./_lib/ai-bot-maintenance')

// WERSJA 22: awaryjny endpoint dla admina.
// Domyślnie wymusza minimum 1 typu dziennie dla Typer Expert i Ograć Buka,
// a jednocześnie zachowuje rozliczenie starych typów przed publikacją.
exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  try {
    const query = event.queryStringParameters || {}
    const result = await runMaintenance({
      ...event,
      queryStringParameters: {
        ...query,
        source: query.source || 'admin-background-v22-daily-minimum',
        force_daily: query.force_daily || query.daily || query.min_daily || '1'
      }
    })
    return json(result.ok === false ? 500 : 200, result)
  } catch (error) {
    return json(500, { ok: false, version: MAINTENANCE_VERSION, inserted: 0, error: error.message || String(error) })
  }
}
