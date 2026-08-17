const {
  readTyperProgressionState,
  BOT_POLICIES,
  json
} = require('./_lib/ai-bot-cycle')
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
    const state = await readTyperProgressionState(
      supabase,
      BOT_POLICIES.typer.progression?.targetProfit || 0.4
    )
    const p = BOT_POLICIES.typer
    return json(200, {
      ok: true,
      version: '68-typer-expert-health',
      pending: state.pending.length,
      latest_tip: state.rows[state.rows.length - 1] || null,
      progression: {
        cycle_net: state.cycleNet,
        next_step: state.cycleStep + 1,
        completed_cycles: state.completedCycles,
        total_net: state.totalNet,
        base_stake: p.progression.baseStake,
        target_profit: p.progression.targetProfit,
        max_stake: p.progression.maxStake
      },
      canonical_policy: {
        min_odds: p.minOdds,
        max_odds: p.maxOdds,
        max_pick_hours_ahead: p.maxPickHoursAhead,
        min_probability: p.minProbability,
        max_spread: p.maxSpread,
        policy_source: 'canonical_code_not_netlify_env'
      }
    })
  } catch (error) {
    return json(500, { ok: false, error: error.message || String(error) })
  }
}
