const { getSupabaseAdmin, MODEL_VERSION } = require('./_lib/algorithm-engine')
const { json } = require('./_lib/algorithm-auth')
const { round } = require('./_lib/algorithm-model')


function isHiddenTechnicalRow(row = {}) {
  const reason = String(row?.formula_snapshot?.selection_reason || '')
  const error = String(row?.analysis_error || '')
  if (reason === 'missing_team_form_final' || reason === 'started_before_analysis') return true
  if (String(row.analysis_state || '') === 'ready' && String(row.selected_market || '') === 'no_bet' && /brak wystarczających kompletnych statystyk/i.test(error)) return true
  return false
}


function nextScheduledScanIso(intervalMinutes = 15, now = new Date()) {
  const interval = Math.max(1, Number(intervalMinutes || 15))
  const next = new Date(now)
  next.setUTCSeconds(0, 0)
  const minute = next.getUTCMinutes()
  const nextMinute = (Math.floor(minute / interval) + 1) * interval
  if (nextMinute >= 60) {
    next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0)
  } else {
    next.setUTCMinutes(nextMinute, 0, 0)
  }
  return next.toISOString()
}

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
    const allRows = Array.isArray(data) ? data : []
    // Techniczne rekordy bez danych pozostają w bazie dla diagnostyki, ale nie
    // zaśmiecają dashboardu ani statystyk użytkownika.
    const hiddenTechnicalRows = allRows.filter(isHiddenTechnicalRow)
    const rows = allRows.filter(row => !isHiddenTechnicalRow(row))
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

    let workerLock = null
    try {
      const { data: lockData, error: lockError } = await supabase
        .from('algorithm_worker_locks')
        .select('lock_name,locked_by,locked_until,updated_at')
        .eq('lock_name', 'algorithm-main-worker')
        .maybeSingle()
      if (!lockError) workerLock = lockData || null
    } catch (_) {}

    const currentTime = Date.now()
    const activeAllRows = allRows.filter(row => {
      const kickoff = Date.parse(row.kickoff || '')
      return Number.isFinite(kickoff) && kickoff > currentTime
    })
    const activeHiddenRows = activeAllRows.filter(isHiddenTechnicalRow)
    const activeVisibleRows = activeAllRows.filter(row => !isHiddenTechnicalRow(row))
    const activeWaitingRows = activeVisibleRows.filter(row => String(row.analysis_state || 'ready') !== 'ready')
    const activeReadyRows = activeVisibleRows.filter(row => String(row.analysis_state || 'ready') === 'ready')
    const activePickRows = activeReadyRows.filter(row => row.selected_market !== 'no_bet' && Number(row.stake || 0) > 0)
    const processedCount = activeReadyRows.length + activeHiddenRows.length
    const totalCount = activeAllRows.length
    const progressPercent = totalCount > 0 ? round(processedCount / totalCount * 100, 1) : 0
    const workerLockedUntil = workerLock?.locked_until || null
    const workerRunning = Number.isFinite(Date.parse(workerLockedUntil || '')) && Date.parse(workerLockedUntil) > currentTime
    const latestScan = latestRuns.find(row => row.run_type === 'scan') || null

    return json(200, {
      rows,
      latest_runs: latestRuns,
      latest_scan: latestScan,
      latest_settlement: latestRuns.find(row => row.run_type === 'settle') || null,
      summary: {
        analyzed: rows.length,
        hidden_technical: hiddenTechnicalRows.length,
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
        min_odds: null,
        rule: 'Wyłącznie pre-match: jeden worker pobiera dane z kontrolą tempa, wybiera wyższe prawdopodobieństwo i zapisuje 1 jednostkę przy minimum 51%. Nie ma minimalnego kursu; każdy poprawny kurs powyżej 1.00 jest zapisywany. Po pełnym sprawdzeniu brak kompletu statystyk kończy analizę i rekord znika z dashboardu.'
      },
      automation: {
        scan_every_minutes: 15,
        settles_before_each_scan: true,
        mode: 'single-locked-throttled-prematch-worker',
        api_min_interval_ms: Number(process.env.ALGORITHM_API_MIN_INTERVAL_MS || 350),
        prematch_min_lead_minutes: Number(process.env.ALGORITHM_PREMATCH_MIN_LEAD_MINUTES || 10),
        worker_running: workerRunning,
        worker_locked_until: workerLockedUntil,
        worker_updated_at: workerLock?.updated_at || null,
        next_scan_at: nextScheduledScanIso(15),
        progress: {
          total: totalCount,
          processed: processedCount,
          percent: progressPercent,
          ready: activeReadyRows.length,
          picks: activePickRows.length,
          waiting: activeWaitingRows.length,
          no_data: activeHiddenRows.length,
          last_scan_status: latestScan?.status || null,
          last_scan_finished_at: latestScan?.finished_at || null
        }
      }
    })
  } catch (error) {
    console.error('get-algorithm-picks failed', error)
    return json(500, { error: String(error?.message || error) })
  }
}
