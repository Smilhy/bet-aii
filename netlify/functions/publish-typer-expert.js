const { runAiBotCycle, json } = require('./_lib/ai-bot-cycle')
const settleTyperExpert = require('./settle-typer-expert')

// WERSJA 68:
// Każdy 2-godzinny cykl Typer Expert najpierw rozlicza jego własny poprzedni typ.
// Dzięki temu ukryty/stary pending nie blokuje progresji przez wiele dni.
// Dopiero po rozliczeniu system liczy następną stawkę progresji i publikuje max 1 typ.
exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  try {
    let settlement = null
    try {
      const response = await settleTyperExpert.handler({
        httpMethod: 'POST',
        queryStringParameters: {
          ...(event.queryStringParameters || {}),
          source: 'publish-typer-expert-v68-pre-settle',
          stale_pst_void_hours: (event.queryStringParameters || {}).stale_pst_void_hours || '24'
        }
      })
      try { settlement = response?.body ? JSON.parse(response.body) : null } catch (_) { settlement = null }
    } catch (error) {
      settlement = { ok: false, error: error.message || String(error) }
    }

    const result = await runAiBotCycle(event, { bots: 'typer', maxPicks: 1 })
    return json(result.ok === false ? 500 : 200, {
      ...result,
      typer_expert_pre_settlement_v67: settlement
    })
  } catch (error) {
    return json(500, { ok: false, inserted: 0, error: error.message || String(error) })
  }
}
