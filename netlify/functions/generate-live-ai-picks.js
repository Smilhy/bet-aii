const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(Number(value || 0) * factor) / factor
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function nowIso() { return new Date().toISOString() }

const LIVE_ONLY_COLUMNS = new Set(['live_minute','live_score_home','live_score_away','live_status'])
function stripLiveColumns(rows) { return rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !LIVE_ONLY_COLUMNS.has(key)))) }
function isSchemaCacheColumnError(error) { const msg = String(error?.message || error || '').toLowerCase(); return msg.includes('schema cache') || msg.includes('could not find') || msg.includes('pgrst204') }

async function fetchLiveFixtures() {
  if (!API_FOOTBALL_KEY) return []
  const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API-Football live error ${res.status}: ${text}`)
  }
  const data = await res.json()
  return Array.isArray(data.response) ? data.response : []
}

function buildLivePick(fixture) {
  const home = fixture?.teams?.home?.name || 'Home'
  const away = fixture?.teams?.away?.name || 'Away'
  const league = fixture?.league?.name || 'Live Football'
  const country = fixture?.league?.country || null
  const minute = Number(fixture?.fixture?.status?.elapsed || 0)
  const statusShort = fixture?.fixture?.status?.short || 'LIVE'
  const homeGoals = Number(fixture?.goals?.home ?? 0)
  const awayGoals = Number(fixture?.goals?.away ?? 0)
  const totalGoals = homeGoals + awayGoals
  const goalDiff = Math.abs(homeGoals - awayGoals)

  let pick = 'Under 3.5 Goals'
  let market = 'Over/Under'
  let odds = 1.72
  let modelProbability = 62
  let risk = 'medium'

  if (minute <= 30 && totalGoals === 0) {
    pick = 'Under 3.5 Goals'
    odds = 1.62
    modelProbability = 68
    risk = 'low'
  } else if (minute <= 55 && totalGoals >= 2) {
    pick = 'Over 2.5 Goals'
    odds = 1.80
    modelProbability = 66
    risk = 'medium'
  } else if (minute >= 60 && goalDiff >= 1) {
    const leader = homeGoals > awayGoals ? home : away
    pick = `${leader} or Draw`
    market = 'Double Chance'
    odds = 1.45
    modelProbability = 73
    risk = 'low'
  } else if (minute >= 70 && totalGoals <= 1) {
    pick = 'Under 2.5 Goals'
    odds = 1.58
    modelProbability = 71
    risk = 'low'
  } else if (totalGoals >= 3) {
    pick = 'Over 3.5 Goals'
    odds = 2.05
    modelProbability = 58
    risk = 'high'
  }

  const impliedProbability = round((1 / odds) * 100, 2)
  const valueScore = round(modelProbability - impliedProbability, 2)
  const confidence = clamp(round(modelProbability + Math.max(0, valueScore / 2), 2), 50, 88)
  const aiScore = clamp(round((confidence * 0.75) + (Math.max(0, valueScore) * 2.5), 2), 0, 98)

  return {
    author_name: 'BetAI Live Engine',
    league,
    league_name: league,
    sport: 'football',
    country,
    team_home: home,
    team_away: away,
    match_name: `${home} vs ${away}`,
    bet_type: market,
    pick,
    odds,
    implied_probability: impliedProbability,
    model_probability: modelProbability,
    value_score: valueScore,
    ai_confidence: confidence,
    ai_score: aiScore,
    risk_level: risk,
    bookmaker: 'Live model',
    event_time: fixture?.fixture?.date || nowIso(),
    kickoff_time: fixture?.fixture?.date || nowIso(),
    match_time: fixture?.fixture?.date || nowIso(),
    live_minute: minute,
    live_score_home: homeGoals,
    live_score_away: awayGoals,
    live_status: statusShort,
    status: 'pending',
    result: 'pending',
    profit: 0,
    source: 'live_ai_engine',
    ai_source: 'real_ai_engine',
    access_type: aiScore >= 82 ? 'premium' : 'free',
    is_premium: aiScore >= 82,
    price: aiScore >= 82 ? 9 : 0,
    created_at: nowIso()
  }
}

async function buildLiveAnalysis(pick) {
  const fallback = `LIVE AI: ${pick.match_name}, minuta ${pick.live_minute || '-'}, wynik ${pick.live_score_home}:${pick.live_score_away}. Model wskazuje ${pick.pick} przy confidence ${pick.ai_confidence}% i value ${pick.value_score} pp.`
  if (!OPENAI_API_KEY) return fallback
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Jesteś analitykiem live betting. Pisz po polsku, maksymalnie 2 zdania, bez obietnic zysku.' },
          { role: 'user', content: `Napisz analizę live dla typu. Mecz: ${pick.match_name}. Liga: ${pick.league_name}. Minuta: ${pick.live_minute}. Wynik: ${pick.live_score_home}:${pick.live_score_away}. Typ: ${pick.pick}. Kurs modelowy: ${pick.odds}. Confidence: ${pick.ai_confidence}%. Value: ${pick.value_score} pp. Ryzyko: ${pick.risk_level}.` }
        ],
        temperature: 0.22,
        max_tokens: 120
      })
    })
    if (!res.ok) return fallback
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || fallback
  } catch (e) {
    return fallback
  }
}

exports.handler = async function () {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'Missing Supabase env: SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
    if (!API_FOOTBALL_KEY) return json(400, { error: 'Missing API_FOOTBALL_KEY. Live AI needs API-Football.' })

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const fixtures = await fetchLiveFixtures()

    if (!fixtures.length) {
      return json(200, { inserted: 0, message: 'Brak meczów LIVE w API-Football w tej chwili.' })
    }

    const rows = []
    for (const fixture of fixtures.slice(0, Number(process.env.LIVE_AI_LIMIT || 20))) {
      const candidate = buildLivePick(fixture)
      // only save positive value or low risk live picks
      if (candidate.value_score < Number(process.env.LIVE_MIN_VALUE_SCORE || 1.0) && candidate.risk_level !== 'low') continue
      const analysis = await buildLiveAnalysis(candidate)
      rows.push({ ...candidate, analysis, ai_analysis: analysis })
    }

    if (!rows.length) return json(200, { inserted: 0, message: 'Live mecze znalezione, ale brak value picków według filtra.' })

    await supabase
      .from('tips')
      .delete()
      .eq('ai_source', 'real_ai_engine')
      .eq('source', 'live_ai_engine')
      .eq('result', 'pending')

    let { data, error } = await supabase.from('tips').insert(rows).select('id')
    let schema_cache_fallback = false
    if (error && isSchemaCacheColumnError(error)) {
      schema_cache_fallback = true
      const retryRows = stripLiveColumns(rows).map(row => ({
        ...row,
        analysis: ((row.analysis || "") + " LIVE: " + (row.live_minute || "-") + " min, wynik " + (row.live_score_home ?? 0) + ":" + (row.live_score_away ?? 0) + ", status " + (row.live_status || "LIVE") + ".").trim(),
        ai_analysis: ((row.ai_analysis || row.analysis || "") + " LIVE: " + (row.live_minute || "-") + " min, wynik " + (row.live_score_home ?? 0) + ":" + (row.live_score_away ?? 0) + ", status " + (row.live_status || "LIVE") + ".").trim(),
        status: 'pending'
      }))
      ;({ data, error } = await supabase.from('tips').insert(retryRows).select('id'))
    }
    if (error) throw error
    const { error: runLogError } = await supabase.from('ai_pick_runs').insert({
      source: 'live_ai_engine+api_football+openai_analysis',
      picks_created: data?.length || 0,
      status: 'success',
      finished_at: nowIso()
    })
    if (runLogError) console.warn('Live AI run log skipped:', runLogError.message)

    return json(200, { inserted: data?.length || 0, live_matches_checked: fixtures.length, source: 'live_ai_engine', schema_cache_fallback })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'Live AI Engine error' })
  }
}
