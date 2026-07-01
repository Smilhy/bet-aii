const { runAiBotCycle, json } = require('./_lib/ai-bot-cycle')

// WERSJA 1867.9: endpoint zbiorczy służy wyłącznie do ręcznego testu.
// Każdy bot ma własny niezależny harmonogram w netlify.toml.
exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  try {
    const result = await runAiBotCycle(event, {
      bots: 'betai,typer,ograc',
      maxPicks: 3
    })
    return json(result.ok === false ? 500 : 200, {
      ...result,
      scheduler: {
        mode: 'independent_bots',
        cooldown_hours: { betai: 0, typer: 2, ograc: 0 },
        typer_expert_lock: 'previous_unsettled_pick_and_2h_cooldown_for_progression'
      }
    })
  } catch (error) {
    return json(500, { ok: false, inserted: 0, error: error.message || String(error) })
  }
}
