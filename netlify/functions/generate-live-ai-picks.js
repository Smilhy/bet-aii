const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } }
function round(value, decimals = 2) { const f = 10 ** decimals; return Math.round(Number(value || 0) * f) / f }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }
function nowIso() { return new Date().toISOString() }
function isoDate(d) { return d.toISOString().slice(0, 10) }

async function apiFootball(path) {
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } })
  if (!res.ok) throw new Error(`API-Football ${path} error ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return Array.isArray(data.response) ? data.response : []
}

async function fetchRealFixtures() {
  const live = await apiFootball('fixtures?live=all')
  const today = new Date()
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const upcomingToday = await apiFootball(`fixtures?date=${isoDate(today)}&status=NS`)
  const upcomingTomorrow = isoDate(tomorrow) === isoDate(today) ? [] : await apiFootball(`fixtures?date=${isoDate(tomorrow)}&status=NS`)
  const soonLimitMs = Number(process.env.REAL_MATCHES_SOON_HOURS || 8) * 60 * 60 * 1000
  const soon = [...upcomingToday, ...upcomingTomorrow].filter(f => {
    const t = new Date(f?.fixture?.date || 0).getTime()
    return Number.isFinite(t) && t >= Date.now() - 15 * 60 * 1000 && t <= Date.now() + soonLimitMs
  })
  const seen = new Set()
  return [...live, ...soon].filter(f => {
    const id = String(f?.fixture?.id || '')
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function choosePick(fixture) {
  const minute = Number(fixture?.fixture?.status?.elapsed || 0)
  const statusShort = String(fixture?.fixture?.status?.short || 'NS').toUpperCase()
  const hg = Number(fixture?.goals?.home ?? 0)
  const ag = Number(fixture?.goals?.away ?? 0)
  const total = hg + ag
  const diff = Math.abs(hg - ag)
  const home = fixture?.teams?.home?.name || 'Home'
  const away = fixture?.teams?.away?.name || 'Away'

  let pick = 'Over 1.5 Goals', market = 'Goals', odds = 1.58, probability = 67, risk = 'low'
  if (statusShort === 'NS') {
    pick = 'Over 1.5 Goals'; market = 'Goals'; odds = 1.55; probability = 68; risk = 'low'
  } else if (minute <= 30 && total === 0) {
    pick = 'Under 3.5 Goals'; market = 'Goals'; odds = 1.62; probability = 69; risk = 'low'
  } else if (minute <= 55 && total >= 2) {
    pick = 'Over 2.5 Goals'; market = 'Goals'; odds = 1.80; probability = 66; risk = 'medium'
  } else if (minute >= 60 && diff >= 1) {
    pick = `${hg > ag ? home : away} or Draw`; market = 'Double Chance'; odds = 1.45; probability = 74; risk = 'low'
  } else if (minute >= 70 && total <= 1) {
    pick = 'Under 2.5 Goals'; market = 'Goals'; odds = 1.58; probability = 71; risk = 'low'
  } else if (total >= 3) {
    pick = 'Over 3.5 Goals'; market = 'Goals'; odds = 2.05; probability = 58; risk = 'high'
  }
  const implied = round((1 / odds) * 100, 2)
  const value = round(probability - implied, 2)
  const confidence = clamp(round(probability + Math.max(0, value / 2), 2), 50, 90)
  return { pick, market, odds, probability, implied, value, confidence, risk }
}

function buildRow(fixture) {
  const home = fixture?.teams?.home?.name || 'Home'
  const away = fixture?.teams?.away?.name || 'Away'
  const league = fixture?.league?.name || 'Football'
  const country = fixture?.league?.country || null
  const statusShort = String(fixture?.fixture?.status?.short || 'NS').toUpperCase()
  const isLive = statusShort !== 'NS'
  const p = choosePick(fixture)
  const kickoff = fixture?.fixture?.date || nowIso()
  return {
    external_fixture_id: String(fixture?.fixture?.id || ''),
    author_name: 'BetAI Real Matches Engine',
    league,
    league_name: league,
    sport: 'football',
    country,
    team_home: home,
    team_away: away,
    match_name: `${home} vs ${away}`,
    bet_type: p.market,
    pick: p.pick,
    odds: p.odds,
    implied_probability: p.implied,
    model_probability: p.probability,
    value_score: p.value,
    ai_confidence: p.confidence,
    ai_score: clamp(round((p.confidence * 0.8) + Math.max(0, p.value) * 2, 2), 0, 98),
    risk_level: p.risk,
    bookmaker: 'Real match model',
    event_time: kickoff,
    kickoff_time: kickoff,
    match_time: kickoff,
    live_minute: Number(fixture?.fixture?.status?.elapsed || 0),
    live_score_home: Number(fixture?.goals?.home ?? 0),
    live_score_away: Number(fixture?.goals?.away ?? 0),
    live_status: statusShort,
    status: isLive ? 'live' : 'pending',
    result: 'pending',
    profit: 0,
    source: 'live_ai_engine',
    ai_source: 'real_ai_engine',
    access_type: p.confidence >= 82 ? 'premium' : 'free',
    is_premium: p.confidence >= 82,
    price: p.confidence >= 82 ? 9 : 0,
    created_at: nowIso()
  }
}

async function analysisFor(row) {
  const fallback = `Realny mecz z API-Football: ${row.match_name}, ${row.live_status === 'NS' ? 'start wkrótce' : `LIVE ${row.live_minute}'`} (${row.live_score_home}:${row.live_score_away}). Typ: ${row.pick}, confidence ${row.ai_confidence}%, value ${row.value_score} pp.`
  if (!OPENAI_API_KEY) return fallback
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: 'Jesteś analitykiem piłkarskim live/prematch. Pisz po polsku, konkretnie, bez obietnic zysku.' }, { role: 'user', content: `Analiza: ${row.match_name}, liga ${row.league_name}, status ${row.live_status}, minuta ${row.live_minute}, wynik ${row.live_score_home}:${row.live_score_away}, typ ${row.pick}, kurs ${row.odds}, confidence ${row.ai_confidence}%, value ${row.value_score} pp.` }], temperature: 0.2, max_tokens: 120 }) })
    if (!res.ok) return fallback
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || fallback
  } catch { return fallback }
}

exports.handler = async function () {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'Missing Supabase env.' })
    if (!API_FOOTBALL_KEY) return json(400, { error: 'Missing API_FOOTBALL_KEY. Real matches need API-Football.' })
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const fixtures = await fetchRealFixtures()
    const rows = []
    for (const f of fixtures.slice(0, Number(process.env.REAL_MATCHES_LIMIT || 40))) {
      const row = buildRow(f)
      if (row.value_score < Number(process.env.REAL_MATCHES_MIN_VALUE_SCORE || 0.5) && row.risk_level !== 'low') continue
      const text = await analysisFor(row)
      rows.push({ ...row, analysis: text, ai_analysis: text })
    }
    if (!rows.length) return json(200, { inserted: 0, matches_checked: fixtures.length, message: 'Brak realnych meczów LIVE/soon spełniających filtr value.' })

    const fixtureIds = rows.map(r => r.external_fixture_id).filter(Boolean)
    if (fixtureIds.length) await supabase.from('tips').delete().eq('ai_source', 'real_ai_engine').eq('source', 'live_ai_engine').in('external_fixture_id', fixtureIds)

    const { data, error } = await supabase.from('tips').insert(rows).select('id')
    if (error) throw error
    await supabase.from('ai_pick_runs').insert({ source: 'live_ai_engine+real_live_and_soon', picks_created: data?.length || 0, status: 'success', finished_at: nowIso() }).catch?.(() => {})
    return json(200, { inserted: data?.length || 0, matches_checked: fixtures.length, live: rows.filter(r => r.status === 'live').length, upcoming: rows.filter(r => r.status === 'pending').length })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'Real Matches Engine error' })
  }
}
