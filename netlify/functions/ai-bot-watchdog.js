const { runMaintenance, json, MAINTENANCE_VERSION } = require('./_lib/ai-bot-maintenance')

// WERSJA 27: twardy watchdog minimum 1 typu dziennie także dla zakładki Typy AI.
// Jeśli BetAI, Typer Expert albo Ograć Buka nie mają typu dzisiaj, endpoint:
// 1) próbuje rozliczyć stare typy,
// 2) odpala szeroki skan,
// 3) w razie braku normalnego value picka używa awaryjnej selekcji meczu.
exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  try {
    const query = event.queryStringParameters || {}
    const result = await runMaintenance({
      ...event,
      queryStringParameters: {
        ...query,
        source: query.source || 'scheduled-watchdog-v27-betai-hard-daily-minimum',
        bots: query.bots || 'betai,typer,ograc',
        force_daily: query.force_daily || '1',
        daily_force: query.daily_force || '1',
        days: query.days || '7',
        min_minutes_before_start: query.min_minutes_before_start || '5',
        max_hours_ahead: query.max_hours_ahead || '168',
        stale_minutes: query.stale_minutes || '1440'
      }
    })
    return json(result.ok === false ? 500 : 200, result)
  } catch (error) {
    return json(500, { ok: false, version: MAINTENANCE_VERSION, inserted: 0, error: error.message || String(error) })
  }
}
