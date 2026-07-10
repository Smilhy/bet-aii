const { getSupabaseAdmin, MODEL_VERSION } = require('./_lib/algorithm-engine')
const { json } = require('./_lib/algorithm-auth')
const { round } = require('./_lib/algorithm-model')

function average(rows, getter) {
  if (!rows.length) return 0
  return rows.reduce((sum, row) => sum + Number(getter(row) || 0), 0) / rows.length
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  const qs = event.queryStringParameters || {}
  const limit = Math.max(1, Math.min(2000, Number(qs.limit || 1000) || 1000))
  const status = String(qs.status || '').trim().toLowerCase()

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('algorithm_bets')
      .select('*')
      .order('kickoff', { ascending: false })
      .limit(limit)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    const rows = Array.isArray(data) ? data : []
    const waiting = rows.filter(row => String(row.analysis_state || 'ready') !== 'ready')
    const bets = rows.filter(row => String(row.analysis_state || 'ready') === 'ready' && row.selected_market !== 'no_bet' && Number(row.stake || 0) > 0)
    const settled = bets.filter(row => ['won', 'lost'].includes(String(row.status || '')))
    const won = settled.filter(row => row.status === 'won').length
    const lost = settled.filter(row => row.status === 'lost').length
    const financiallySettled = settled.filter(row => Number(row.selected_odds || 0) > 1)
    const pending = bets.filter(row => row.status === 'pending').length
    const voided = bets.filter(row => row.status === 'void').length
    const stake = financiallySettled.reduce((sum, row) => sum + Number(row.stake || 0), 0)
    const profit = financiallySettled.reduce((sum, row) => sum + Number(row.profit || 0), 0)

    let latestRuns = []
    try {
      const { data: runData, error: runError } = await supabase
        .from('algorithm_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(12)
      if (!runError) latestRuns = Array.isArray(runData) ? runData : []
    } catch (_) {}

    return json(200, {
      rows,
      latest_runs: latestRuns,
      latest_scan: latestRuns.find(row => row.run_type === 'scan') || null,
      latest_settlement: latestRuns.find(row => row.run_type === 'settle') || null,
      summary: {
        analyzed: rows.length,
        waiting: waiting.length,
        ready: rows.length - waiting.length,
        bets: bets.length,
        settled: settled.length,
        financially_settled: financiallySettled.length,
        settled_without_odds: settled.length - financiallySettled.length,
        bets_without_odds: bets.filter(row => Number(row.selected_odds || 0) <= 1).length,
        won,
        lost,
        pending,
        voided,
        skipped: rows.filter(row => String(row.analysis_state || 'ready') === 'ready' && row.selected_market === 'no_bet').length,
        over_bets: bets.filter(row => row.selected_market === 'over_2_5').length,
        under_bets: bets.filter(row => row.selected_market === 'under_2_5').length,
        profit: round(profit, 2),
        stake: round(stake, 2),
        roi: stake > 0 ? round(profit / stake * 100, 2) : 0,
        hit_rate: settled.length > 0 ? round(won / settled.length * 100, 2) : 0,
        avg_odds: round(average(financiallySettled, row => row.selected_odds), 2),
        avg_probability: round(average(bets, row => row.selected_probability), 2)
      },
      model: {
        version: MODEL_VERSION,
        stake: 1,
        min_probability: 51,
        rule: 'Wyłącznie pre-match: nierozpoczęte mecze są zapisywane do kolejki, jeden worker pobiera dane z kontrolą tempa, wybiera wyższe prawdopodobieństwo i zapisuje 1 jednostkę przy minimum 51%. Brak kursu nie blokuje typu.'
      },
      automation: {
        scan_every_minutes: 15,
        settles_before_each_scan: true,
        mode: 'single-locked-throttled-prematch-worker',
        api_min_interval_ms: Number(process.env.ALGORITHM_API_MIN_INTERVAL_MS || 350),
        prematch_min_lead_minutes: Number(process.env.ALGORITHM_PREMATCH_MIN_LEAD_MINUTES || 10)
      }
    })
  } catch (error) {
    console.error('get-algorithm-picks failed', error)
    return json(500, { error: String(error?.message || error) })
  }
}
