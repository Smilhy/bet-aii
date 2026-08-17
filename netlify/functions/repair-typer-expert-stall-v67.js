const {
  runAiBotCycle,
  readTyperProgressionState,
  repairTyperPendingProgression,
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

function pendingSummary(rows = []) {
  return rows.map(row => ({
    id: row.id,
    created_at: row.created_at,
    fixture_id: row.fixture_id || row.external_fixture_id || row.api_fixture_id || null,
    event_time: row.event_time || row.kickoff_time || row.match_time || row.match_date || null,
    match: row.match_name || row.match || `${row.team_home || ''} — ${row.team_away || ''}`.trim(),
    pick: row.prediction || row.pick || row.bet_type || row.selection || null,
    odds: row.odds || null,
    stake: row.stake ?? row.amount ?? null,
    status: row.status || row.result_status || row.result || row.settlement_status || 'pending'
  }))
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  try {
    const query = event.queryStringParameters || {}
    const supabase = getSupabase()

    // 1) Twarda próba rozliczenia wszystkich widocznych rekordów Typer Expert.
    const settleResponse = await settleTyperExpert.handler({
      httpMethod: 'POST',
      queryStringParameters: {
        ...query,
        source: 'manual-repair-typer-expert-stall-v67',
        repair_days: query.repair_days || '120',
        stale_pst_void_hours: query.stale_pst_void_hours || '24'
      }
    })
    let settlement = {}
    try { settlement = settleResponse?.body ? JSON.parse(settleResponse.body) : {} } catch (_) { settlement = {} }

    // 2) Odtwórz poprawny stan progresji WYŁĄCZNIE z historii Typer Expert.
    const progressionRepair = await repairTyperPendingProgression(
      supabase,
      BOT_POLICIES.typer.progression || { baseStake: 1, maxStake: 1000, targetProfit: 0.4 }
    )
    const beforePublish = await readTyperProgressionState(
      supabase,
      BOT_POLICIES.typer.progression?.targetProfit || 0.4
    )

    // 3) Jeśli nic już nie blokuje progresji, wymuś dzisiejszy typ.
    let publish = null
    if (!beforePublish.pending.length) {
      publish = await runAiBotCycle({
        httpMethod: 'GET',
        queryStringParameters: {
          ...query,
          source: 'manual-repair-typer-expert-stall-v67',
          force: '1',
          daily_force: '1',
          force_daily: '1',
          days: query.days || '7',
          min_minutes_before_start: query.min_minutes_before_start || '5',
          max_hours_ahead: query.max_hours_ahead || '168'
        }
      }, { bots: 'typer', maxPicks: 1 })
    }

    const afterPublish = await readTyperProgressionState(
      supabase,
      BOT_POLICIES.typer.progression?.targetProfit || 0.4
    )

    return json(200, {
      ok: true,
      version: '67-typer-expert-daily-progression-stall-repair',
      settlement,
      progression_repair: progressionRepair,
      before_publish: {
        rows: beforePublish.rows.length,
        pending: beforePublish.pending.length,
        pending_rows: pendingSummary(beforePublish.pending),
        cycle_net: beforePublish.cycleNet,
        next_step: beforePublish.cycleStep + 1,
        completed_cycles: beforePublish.completedCycles,
        total_net: beforePublish.totalNet,
        history_source: beforePublish.historySource,
        history_query_errors: beforePublish.historyQueryErrors
      },
      publish,
      after_publish: {
        rows: afterPublish.rows.length,
        pending: afterPublish.pending.length,
        pending_rows: pendingSummary(afterPublish.pending),
        cycle_net: afterPublish.cycleNet,
        next_step: afterPublish.cycleStep + 1,
        completed_cycles: afterPublish.completedCycles,
        total_net: afterPublish.totalNet
      },
      message: beforePublish.pending.length
        ? 'Typer Expert nadal ma nierozliczony typ. Szczegóły są w before_publish.pending_rows.'
        : (publish?.inserted > 0
          ? 'Stall usunięty i dodano nowy typ Typer Expert z poprawną stawką progresji.'
          : 'Stall usunięty. Progresja jest odblokowana; jeśli nie dodano typu, sprawdź publish.forced_daily_selections/errors.')
    })
  } catch (error) {
    return json(500, {
      ok: false,
      version: '67-typer-expert-daily-progression-stall-repair',
      error: error.message || String(error)
    })
  }
}
