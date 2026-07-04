const { runMaintenance, json, MAINTENANCE_VERSION } = require('./_lib/ai-bot-maintenance')

// WERSJA 22: watchdog pilnuje minimum 1 typu dziennie.
// Jeśli Typer Expert albo Ograć Buka nie mają jeszcze typu w bieżącym dniu
// według czasu Warszawy, odpala awaryjne dodanie typu. Poza tym nadal działa
// standardowe sprawdzanie zastoju.
exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  try {
    const query = event.queryStringParameters || {}
    const result = await runMaintenance({
      ...event,
      queryStringParameters: {
        ...query,
        source: 'scheduled-watchdog-v22-daily-minimum',
        force_daily: query.force_daily || '1',
        stale_minutes: query.stale_minutes || '1440'
      }
    })
    return json(result.ok === false ? 500 : 200, result)
  } catch (error) {
    return json(500, { ok: false, version: MAINTENANCE_VERSION, inserted: 0, error: error.message || String(error) })
  }
}
