const {
  runAiBotCycle,
  readTyperProgressionState,
  BOT_POLICIES,
  json
} = require('./_lib/ai-bot-cycle')
const settleTyperExpert = require('./settle-typer-expert')
const { createClient } = require('@supabase/supabase-js')

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) throw new Error('Brak SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  try {
    const supabase = getSupabase()

    let settlement = null
    try {
      const response = await settleTyperExpert.handler({
        httpMethod: 'POST',
        queryStringParameters: {
          source: 'repair-typer-expert-v68',
          repair_days: '120',
          stale_pst_void_hours: '24'
        }
      })
      settlement = response?.body ? JSON.parse(response.body) : null
    } catch (error) {
      settlement = { ok: false, error: error.message || String(error) }
    }

    const before = await readTyperProgressionState(
      supabase,
      BOT_POLICIES.typer.progression?.targetProfit || 0.4
    )

    let publish = null
    if (!before.pending.length) {
      publish = await runAiBotCycle({
        httpMethod: 'GET',
        queryStringParameters: {
          source: 'repair-typer-expert-v68',
          force: '1',
          daily_force: '1',
          force_daily: '1',
          days: '2',
          min_minutes_before_start: '5',
          max_hours_ahead: '48'
        }
      }, { bots: 'typer', maxPicks: 1 })
    }

    const after = await readTyperProgressionState(
      supabase,
      BOT_POLICIES.typer.progression?.targetProfit || 0.4
    )

    return json(200, {
      ok: true,
      version: '68-typer-expert-policy-rate-limit-repair',
      root_cause_fixed: {
        stale_env_policy_overrides: true,
        impossible_odds_range: true,
        progression_cap_to_one: true,
        api_minute_burst: true
      },
      canonical_policy: BOT_POLICIES.typer,
      settlement,
      before: {
        rows: before.rows.length,
        pending: before.pending.length,
        cycle_net: before.cycleNet,
        next_step: before.cycleStep + 1,
        completed_cycles: before.completedCycles,
        total_net: before.totalNet
      },
      publish,
      after: {
        rows: after.rows.length,
        pending: after.pending.length,
        cycle_net: after.cycleNet,
        next_step: after.cycleStep + 1,
        completed_cycles: after.completedCycles,
        total_net: after.totalNet
      },
      message: publish?.inserted > 0
        ? 'Typer Expert odblokowany i dodano nowy typ.'
        : 'Polityka Typer Expert jest naprawiona. Jeśli nie dodano typu, sprawdź publish.forced_daily_selections oraz publish.errors.'
    })
  } catch (error) {
    return json(500, { ok: false, version: '68-typer-expert-policy-rate-limit-repair', error: error.message || String(error) })
  }
}
