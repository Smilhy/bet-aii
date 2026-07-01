const { createClient } = require('@supabase/supabase-js')
const { AUTHORS, VERSION, BOT_POLICIES, json } = require('./_lib/ai-bot-cycle')

exports.handler = async function(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  const apiKey = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || ''
  const output = {
    ok: Boolean(url && key && apiKey),
    version: VERSION,
    checked_at: new Date().toISOString(),
    env: { SUPABASE_URL: Boolean(url), SUPABASE_SERVICE_ROLE_KEY: Boolean(key), APISPORTS_KEY: Boolean(apiKey) },
    strategies: Object.fromEntries(Object.entries(BOT_POLICIES).map(([bot, policy]) => [bot, {
      name: policy.strategyName,
      cooldown_hours: policy.cooldownHours,
      time_lock: policy.cooldownHours > 0,
      pending_lock: bot === 'typer',
      progression: bot === 'typer' ? policy.progression : null,
      min_odds: policy.minOdds,
      max_odds: policy.maxOdds
    }])),
    latest_tips: {},
    ai_bets: { count: null, latest: null },
    latest_runs: [],
    ai_center: { latest_run: null, radar: [], recommendations: {}, odds_history: {}, no_pick: null, pipeline: [] },
    api_probe: null,
    errors: []
  }
  if (!url || !key) return json(500, output)

  if (apiKey && ['1', 'true', 'yes'].includes(String(event?.queryStringParameters?.probe || '').toLowerCase())) {
    try {
      const response = await fetch('https://v3.football.api-sports.io/status', { headers: { 'x-apisports-key': apiKey } })
      const payload = await response.json().catch(() => ({}))
      output.api_probe = {
        ok: response.ok && !(payload?.errors && Object.keys(payload.errors).length),
        status: response.status,
        account: payload?.response?.account || null,
        subscription: payload?.response?.subscription || null,
        requests: payload?.response?.requests || null,
        errors: payload?.errors || null
      }
    } catch (error) {
      output.api_probe = { ok: false, error: error.message || String(error) }
    }
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } })
  for (const [bot, author] of Object.entries(AUTHORS)) {
    try {
      const { data, error } = await supabase.from('tips').select('*').eq('author_name', author.name).order('created_at', { ascending: false }).limit(3)
      if (error) throw error
      output.latest_tips[bot] = data || []
    } catch (error) {
      output.errors.push(`tips ${bot}: ${error.message || error}`)
      output.latest_tips[bot] = []
    }
  }
  try {
    const { data, error, count } = await supabase.from('ai_bets').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(3)
    if (error) throw error
    output.ai_bets = { count, latest: data || [] }
  } catch (error) { output.errors.push(`ai_bets: ${error.message || error}`) }
  try {
    const { data, error } = await supabase.from('ai_pick_runs').select('*').order('finished_at', { ascending: false }).limit(24)
    if (error) throw error
    const runs = data || []
    output.latest_runs = runs.slice(0, 5)

    const readDetails = row => {
      if (!row) return {}
      if (row.details && typeof row.details === 'object') return row.details
      try { return JSON.parse(row.details || '{}') } catch (_) { return {} }
    }
    const latestWithRadar = runs.find(row => readDetails(row)?.radar?.by_bot?.betai?.length) || runs[0] || null
    const latestDetails = readDetails(latestWithRadar)
    const radar = Array.isArray(latestDetails?.radar?.by_bot?.betai) ? latestDetails.radar.by_bot.betai : []
    const history = {}
    ;[...runs].reverse().forEach(row => {
      const details = readDetails(row)
      const rows = Array.isArray(details?.radar?.by_bot?.betai) ? details.radar.by_bot.betai : []
      rows.forEach(candidate => {
        const key = candidate.key || `${candidate.fixture_id || ''}|${candidate.market_key || candidate.market || ''}|${candidate.selection_key || candidate.selection || ''}`
        if (!key || !candidate.odds) return
        if (!history[key]) history[key] = []
        const point = {
          at: row.finished_at || row.created_at || details?.radar?.generated_at || null,
          odds: Number(candidate.odds || 0),
          median_odds: Number(candidate.median_odds || candidate.odds || 0),
          min_odds: Number(candidate.min_odds_seen || candidate.odds || 0),
          max_odds: Number(candidate.max_odds_seen || candidate.odds || 0),
          bookmaker: candidate.bookmaker || ''
        }
        const previous = history[key][history[key].length - 1]
        if (!previous || previous.odds !== point.odds || previous.at !== point.at) history[key].push(point)
      })
    })
    Object.keys(history).forEach(key => { history[key] = history[key].slice(-12) })

    const distinct = (rows, scorer) => {
      const sorted = [...rows].sort((a, b) => scorer(b) - scorer(a))
      return sorted[0] || null
    }
    const safe = distinct(radar, row => Number(row.probability || 0) * 1.4 - Math.max(0, Number(row.odds || 0) - 2.15) * 18 - Number(row.spread || 0))
    const value = distinct(radar, row => Number(row.edge || 0) * 5 + Number(row.quality || 0) + Number(row.books_count || 0) * 2)
    const aggressive = distinct(radar.filter(row => Number(row.odds || 0) >= 2.25), row => Number(row.odds || 0) * 14 + Number(row.edge || 0) * 3 + Number(row.quality || 0)) || distinct(radar, row => Number(row.odds || 0) * 10 + Number(row.quality || 0))

    const inserted = Number(latestDetails?.inserted || latestWithRadar?.picks_created || 0)
    const summary = latestDetails?.radar?.summary || {}
    output.ai_center = {
      latest_run: latestWithRadar ? {
        id: latestWithRadar.id,
        status: latestWithRadar.status,
        finished_at: latestWithRadar.finished_at || latestWithRadar.created_at,
        picks_created: latestWithRadar.picks_created,
        message: latestDetails?.message || '',
        errors: latestDetails?.errors || [],
        fixtures_found: Number(latestDetails?.fixtures_found || summary.fixtures_found || 0),
        odds_fixtures_found: Number(latestDetails?.odds_fixtures_found || summary.odds_fixtures_found || 0),
        candidates_found: Number(latestDetails?.candidates_found || summary.candidates_found || 0),
        inserted,
        strategy_candidates: latestDetails?.strategy_candidates || {}
      } : null,
      radar,
      recommendations: { safe, value, aggressive },
      odds_history: history,
      pipeline: Array.isArray(latestDetails?.pipeline) ? latestDetails.pipeline : [],
      no_pick: inserted > 0 ? null : {
        reason: latestDetails?.message || latestWithRadar?.error_message || 'Ostatni skan nie opublikował typu.',
        fixtures_found: Number(latestDetails?.fixtures_found || summary.fixtures_found || 0),
        odds_fixtures_found: Number(latestDetails?.odds_fixtures_found || summary.odds_fixtures_found || 0),
        candidates_found: Number(latestDetails?.candidates_found || summary.candidates_found || 0),
        errors: latestDetails?.errors || []
      }
    }
  } catch (error) { output.errors.push(`ai_pick_runs: ${error.message || error}`) }
  return json(output.ok ? 200 : 500, output)
}
