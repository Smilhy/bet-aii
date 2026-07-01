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
    const { data, error } = await supabase.from('ai_pick_runs').select('*').order('finished_at', { ascending: false }).limit(5)
    if (error) throw error
    output.latest_runs = data || []
  } catch (error) { output.errors.push(`ai_pick_runs: ${error.message || error}`) }
  return json(output.ok ? 200 : 500, output)
}
