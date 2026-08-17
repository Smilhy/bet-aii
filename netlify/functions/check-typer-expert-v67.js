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

function rowInfo(row = {}) {
  return {
    id: row.id,
    created_at: row.created_at,
    event_time: row.event_time || row.kickoff_time || row.match_time || row.match_date || null,
    fixture_id: row.fixture_id || row.external_fixture_id || row.api_fixture_id || null,
    match: row.match_name || row.match || `${row.team_home || ''} — ${row.team_away || ''}`.trim(),
    pick: row.prediction || row.pick || row.bet_type || row.selection || null,
    odds: row.odds || null,
    stake: row.stake ?? row.amount ?? null,
    status: row.status || row.result_status || row.result || row.settlement_status || 'pending'
  }
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  try {
    const supabase = getSupabase()
    const state = await readTyperProgressionState(
      supabase,
      BOT_POLICIES.typer.progression?.targetProfit || 0.4
    )
    const latest = [...state.rows]
      .sort((a, b) => (Date.parse(b?.created_at || '') || 0) - (Date.parse(a?.created_at || '') || 0))[0] || null

    return json(200, {
      ok: true,
      version: '67-typer-expert-health',
      history_rows: state.rows.length,
      pending: state.pending.length,
      pending_rows: state.pending.map(rowInfo),
      latest_tip: latest ? rowInfo(latest) : null,
      progression: {
        cycle_net: state.cycleNet,
        next_step: state.cycleStep + 1,
        completed_cycles: state.completedCycles,
        total_net: state.totalNet,
        base_stake: BOT_POLICIES.typer.progression?.baseStake || 1,
        target_profit: BOT_POLICIES.typer.progression?.targetProfit || 0.4,
        max_stake: BOT_POLICIES.typer.progression?.maxStake || 1000
      },
      history_source: state.historySource,
      history_query_errors: state.historyQueryErrors || [],
      scheduler_expected: {
        publish: '27 */2 * * *',
        settle: '37 * * * *',
        watchdog: '9 * * * *'
      }
    })
  } catch (error) {
    return json(500, { ok: false, version: '67-typer-expert-health', error: error.message || String(error) })
  }
}
