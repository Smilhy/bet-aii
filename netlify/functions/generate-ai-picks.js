const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ODDS_API_KEY = process.env.ODDS_API_KEY
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const DEFAULT_SPORT_KEYS = [
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_italy_serie_a',
  'soccer_germany_bundesliga',
  'soccer_france_ligue_one',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league',
  'soccer_brazil_campeonato',
  'soccer_argentina_primera_division',
  'soccer_mexico_ligamx'
]

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(Number(value || 0) * factor) / factor
}

function getSportKeys() {
  const custom = process.env.ODDS_SPORT_KEYS
  if (!custom) return DEFAULT_SPORT_KEYS
  return custom.split(',').map((x) => x.trim()).filter(Boolean)
}

function nowIso() {
  return new Date().toISOString()
}

function tomorrowIso() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchOddsForSport(sportKey) {
  const params = new URLSearchParams({
    apiKey: ODDS_API_KEY,
    regions: process.env.ODDS_REGIONS || 'eu,uk',
    markets: process.env.ODDS_MARKETS || 'h2h,totals',
    oddsFormat: 'decimal',
    dateFormat: 'iso'
  })

  const url = `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sportKey)}/odds?${params.toString()}`
  const res = await fetch(url)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn(`Odds API ${sportKey} ${res.status}: ${text}`)
    return []
  }

  const data = await res.json()
  return Array.isArray(data) ? data.map((row) => ({ ...row, sport_key: sportKey })) : []
}

async function fetchOddsEvents() {
  if (!ODDS_API_KEY) return []
  const sportKeys = getSportKeys()
  const results = []

  for (const key of sportKeys) {
    const rows = await fetchOddsForSport(key)
    results.push(...rows)
  }

  return results
}

async function fetchApiFootballFixtures() {
  if (!API_FOOTBALL_KEY) return []

  const dates = [todayIso(), tomorrowIso()]
  const fixtures = []

  for (const date of dates) {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers: { 'x-apisports-key': API_FOOTBALL_KEY }
    })
    if (!res.ok) {
      console.warn(`API-Football fixtures ${date} ${res.status}`)
      continue
    }
    const data = await res.json()
    if (Array.isArray(data.response)) fixtures.push(...data.response)
  }

  return fixtures
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function findFixtureMeta(event, fixtures) {
  const home = normalizeName(event.home_team)
  const away = normalizeName(event.away_team)
  if (!home || !away) return null

  return fixtures.find((fixture) => {
    const fh = normalizeName(fixture?.teams?.home?.name)
    const fa = normalizeName(fixture?.teams?.away?.name)
    return (fh && fa && ((fh.includes(home.slice(0, 8)) && fa.includes(away.slice(0, 8))) || (home.includes(fh.slice(0, 8)) && away.includes(fa.slice(0, 8)))))
  }) || null
}

function extractMarkets(event) {
  const markets = []

  for (const bookmaker of event.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (!['h2h', 'totals'].includes(market.key)) continue
      for (const outcome of market.outcomes || []) {
        if (!outcome?.name || !outcome?.price) continue
        markets.push({
          bookmaker: bookmaker.title || bookmaker.key || 'Bookmaker',
          marketKey: market.key,
          outcomeName: outcome.name,
          point: outcome.point ?? null,
          price: Number(outcome.price)
        })
      }
    }
  }

  return markets.filter((m) => Number.isFinite(m.price) && m.price >= 1.35 && m.price <= 3.25)
}

function buildConsensusProbabilities(markets) {
  const grouped = new Map()

  for (const market of markets) {
    const key = `${market.marketKey}|${market.point ?? 'none'}|${market.bookmaker}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(market)
  }

  const probabilityBuckets = new Map()

  for (const group of grouped.values()) {
    const sumImplied = group.reduce((sum, item) => sum + (1 / item.price), 0)
    if (!sumImplied) continue

    for (const item of group) {
      const selectionKey = `${item.marketKey}|${item.point ?? 'none'}|${item.outcomeName}`
      const noVigProb = (1 / item.price) / sumImplied
      if (!probabilityBuckets.has(selectionKey)) probabilityBuckets.set(selectionKey, [])
      probabilityBuckets.get(selectionKey).push(noVigProb)
    }
  }

  const result = new Map()
  for (const [key, probs] of probabilityBuckets.entries()) {
    result.set(key, probs.reduce((a, b) => a + b, 0) / probs.length)
  }
  return result
}

function pickCandidates(event, fixtureMeta) {
  const markets = extractMarkets(event)
  if (!markets.length) return []

  const consensus = buildConsensusProbabilities(markets)
  const bestBySelection = new Map()

  for (const market of markets) {
    const selectionKey = `${market.marketKey}|${market.point ?? 'none'}|${market.outcomeName}`
    const existing = bestBySelection.get(selectionKey)
    if (!existing || market.price > existing.price) bestBySelection.set(selectionKey, market)
  }

  const candidates = []
  for (const [selectionKey, market] of bestBySelection.entries()) {
    const modelProbability = consensus.get(selectionKey)
    if (!modelProbability) continue

    const impliedProbability = 1 / market.price
    const rawValue = modelProbability - impliedProbability
    const valueScore = round(rawValue * 100, 2)

    // Only genuine value candidates. This prevents fake/random picks.
    if (valueScore < Number(process.env.MIN_VALUE_SCORE || 2.5)) continue

    const confidence = clamp(round(modelProbability * 100, 2), 51, 91)
    const aiScore = clamp(round((confidence * 0.7) + (valueScore * 3), 2), 0, 99)
    const riskLevel = confidence >= 72 && valueScore >= 5 ? 'low' : confidence >= 61 ? 'medium' : 'high'

    const leagueName = fixtureMeta?.league?.name || event.sport_title || event.sport_key || 'Football'
    const country = fixtureMeta?.league?.country || null
    const home = event.home_team || fixtureMeta?.teams?.home?.name || 'Home'
    const away = event.away_team || fixtureMeta?.teams?.away?.name || 'Away'
    const marketLabel = market.marketKey === 'totals'
      ? `${market.outcomeName} ${market.point}`
      : market.outcomeName

    candidates.push({
      author_name: 'BetAI Engine',
      league: leagueName,
      league_name: leagueName,
      sport: 'football',
      country,
      team_home: home,
      team_away: away,
      match_name: `${home} vs ${away}`,
      bet_type: market.marketKey === 'totals' ? 'Over/Under' : '1X2',
      pick: marketLabel,
      selection: market.outcomeName,
      market_key: market.marketKey,
      odds: round(market.price, 2),
      implied_probability: round(impliedProbability * 100, 2),
      model_probability: round(modelProbability * 100, 2),
      value_score: valueScore,
      ai_confidence: confidence,
      ai_score: aiScore,
      risk_level: riskLevel,
      bookmaker: market.bookmaker,
      event_time: event.commence_time || fixtureMeta?.fixture?.date || null,
      kickoff_time: event.commence_time || fixtureMeta?.fixture?.date || null,
      match_time: event.commence_time || fixtureMeta?.fixture?.date || null,
      status: 'pending',
      result: 'pending',
      profit: 0,
      source: 'odds_api_real_v138',
      ai_source: 'real_ai_engine',
      access_type: aiScore >= 82 ? 'premium' : 'free',
      is_premium: aiScore >= 82,
      price: aiScore >= 82 ? 9 : 0,
      created_at: nowIso()
    })
  }

  return candidates.sort((a, b) => b.ai_score - a.ai_score)
}

async function buildAiAnalysis(pick) {
  const fallback = `Realny typ AI oparty o kursy bukmacherów i konsensus rynku. Model ocenia prawdopodobieństwo na ${pick.model_probability}%, przy implied probability ${pick.implied_probability}% i value ${pick.value_score} pp.`
  if (!OPENAI_API_KEY) return fallback

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Jesteś analitykiem bettingowym. Pisz po polsku, krótko i rzeczowo. Nie obiecuj gwarantowanego zysku. Wyjaśniaj value bet.'
          },
          {
            role: 'user',
            content: `Napisz maksymalnie 2 zdania analizy dla typu AI. Mecz: ${pick.match_name}. Liga: ${pick.league_name}. Rynek: ${pick.bet_type}. Typ: ${pick.pick}. Kurs: ${pick.odds}. Model probability: ${pick.model_probability}%. Implied probability: ${pick.implied_probability}%. Value score: ${pick.value_score} pp. Risk: ${pick.risk_level}.`
          }
        ],
        temperature: 0.25,
        max_tokens: 120
      })
    })

    if (!res.ok) return fallback
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || fallback
  } catch (error) {
    console.warn('OpenAI analysis fallback:', error.message)
    return fallback
  }
}

exports.handler = async function () {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'Missing Supabase env: SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
    if (!ODDS_API_KEY) return json(400, { error: 'Missing ODDS_API_KEY. Real AI v138 needs real odds.' })

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const [events, fixtures] = await Promise.all([
      fetchOddsEvents(),
      fetchApiFootballFixtures().catch((error) => {
        console.warn('API-Football meta skipped:', error.message)
        return []
      })
    ])

    if (!events.length) {
      return json(200, { inserted: 0, message: 'Brak realnych meczów/kursów z Odds API. Sprawdź ODDS_API_KEY, limity lub sport keys.' })
    }

    const allCandidates = []
    for (const event of events) {
      const fixtureMeta = findFixtureMeta(event, fixtures)
      const eventCandidates = pickCandidates(event, fixtureMeta)
      if (eventCandidates[0]) allCandidates.push(eventCandidates[0]) // 1 best pick per event
    }

    const unique = []
    const seen = new Set()
    for (const candidate of allCandidates.sort((a, b) => b.ai_score - a.ai_score)) {
      const key = `${candidate.match_name}|${candidate.pick}|${candidate.event_time}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(candidate)
    }

    const limit = Number(process.env.AI_PICK_LIMIT || 20)
    const selected = unique.slice(0, limit)

    if (!selected.length) {
      return json(200, { inserted: 0, message: 'Realne mecze znalezione, ale brak value betów powyżej progu MIN_VALUE_SCORE.' })
    }

    const rows = []
    for (const candidate of selected) {
      rows.push({
        ...candidate,
        analysis: await buildAiAnalysis(candidate),
        ai_analysis: await buildAiAnalysis(candidate)
      })
    }

    // Remove only previous pending real v138 picks to avoid duplicates on refresh.
    await supabase
      .from('tips')
      .delete()
      .eq('ai_source', 'real_ai_engine')
      .eq('source', 'odds_api_real_v138')
      .eq('result', 'pending')

    const { data, error } = await supabase.from('tips').insert(rows).select('id')
    if (error) throw error

    const { error: runLogError } = await supabase
      .from('ai_pick_runs')
      .insert({
        source: 'odds_api_real_v138+api_football_meta+openai_analysis',
        picks_created: data?.length || 0,
        status: 'success',
        finished_at: nowIso()
      })
    if (runLogError) console.warn('AI run log insert skipped:', runLogError.message)


    return json(200, {
      inserted: data?.length || 0,
      source: 'real_odds_api',
      markets: process.env.ODDS_MARKETS || 'h2h,totals',
      events_checked: events.length
    })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'AI Engine error' })
  }
}
