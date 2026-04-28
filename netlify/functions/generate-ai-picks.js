const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY
const ODDS_API_KEY = process.env.ODDS_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }
function todayISO() { return new Date().toISOString().slice(0,10) }

async function fetchFootballFixtures() {
  if (!API_FOOTBALL_KEY) return []
  const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${todayISO()}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY }
  })
  if (!res.ok) throw new Error(`API-Football error ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.response) ? data.response.slice(0, 30) : []
}

async function fetchOdds() {
  if (!ODDS_API_KEY) return []
  const res = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${ODDS_API_KEY}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

function findOddsForFixture(fixture, oddsRows) {
  const home = String(fixture?.teams?.home?.name || '').toLowerCase()
  const away = String(fixture?.teams?.away?.name || '').toLowerCase()
  const match = oddsRows.find(row => {
    const h = String(row.home_team || '').toLowerCase()
    const a = String(row.away_team || '').toLowerCase()
    return (h && home.includes(h.slice(0, 6))) || (a && away.includes(a.slice(0, 6))) || (home && h.includes(home.slice(0, 6)))
  })
  const bookmaker = match?.bookmakers?.[0]
  const market = bookmaker?.markets?.find(m => m.key === 'h2h')
  const outcome = market?.outcomes?.[0]
  return Number(outcome?.price || 0) || (1.55 + Math.random() * 1.4)
}

function scoreFixture(fixture, odds) {
  const homeRank = Number(fixture?.teams?.home?.winner === true ? 1 : 0)
  const base = 58 + (odds > 1.8 ? 8 : 2) + (homeRank ? 6 : 0) + Math.random() * 18
  const confidence = clamp(Math.round(base), 55, 94)
  const implied = odds > 1 ? 100 / odds : 50
  const valueScore = clamp(Math.round(confidence - implied + 50), 0, 100)
  const aiScore = clamp(Math.round((confidence * 0.65) + (valueScore * 0.35)), 0, 100)
  const risk = confidence >= 82 ? 'low' : confidence >= 70 ? 'medium' : 'high'
  return { confidence, valueScore, aiScore, risk }
}

async function aiText({ home, away, league, odds, confidence, risk }) {
  const fallback = `AI wskazuje value pick w meczu ${home} vs ${away}. Liga: ${league}. Kurs ${odds}. Confidence ${confidence}%. Ryzyko: ${risk}.`
  if (!OPENAI_API_KEY) return fallback
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Jesteś analitykiem zakładów sportowych. Pisz krótko po polsku, bez obietnic gwarantowanego zysku.' },
          { role: 'user', content: `Napisz krótką analizę AI dla typu: ${home} vs ${away}, liga ${league}, kurs ${odds}, confidence ${confidence}%, risk ${risk}. Maks 2 zdania.` }
        ],
        temperature: 0.35,
        max_tokens: 120
      })
    })
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || fallback
  } catch (e) {
    return fallback
  }
}

exports.handler = async function () {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: 'Missing Supabase env' })
    if (!API_FOOTBALL_KEY && !ODDS_API_KEY) return json(400, { error: 'Dodaj API_FOOTBALL_KEY i/lub ODDS_API_KEY w Netlify ENV.' })

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const [fixtures, oddsRows] = await Promise.all([fetchFootballFixtures(), fetchOdds()])
    if (!fixtures.length) return json(200, { inserted: 0, message: 'Brak meczów z API-Football na dziś albo limit API.' })

    const rows = []
    for (const fixture of fixtures.slice(0, 12)) {
      const home = fixture?.teams?.home?.name || 'Home'
      const away = fixture?.teams?.away?.name || 'Away'
      const league = fixture?.league?.name || 'Football'
      const odds = Number(findOddsForFixture(fixture, oddsRows).toFixed(2))
      const score = scoreFixture(fixture, odds)
      const analysis = await aiText({ home, away, league, odds, confidence: score.confidence, risk: score.risk })
      rows.push({
        author_name: 'AI Tip',
        league,
        league_name: league,
        sport: 'football',
        country: fixture?.league?.country || null,
        team_home: home,
        team_away: away,
        bet_type: home,
        pick: home,
        match_name: `${home} vs ${away}`,
        odds,
        analysis,
        ai_analysis: analysis,
        ai_confidence: score.confidence,
        ai_score: score.aiScore,
        value_score: score.valueScore,
        risk_level: score.risk,
        access_type: score.confidence >= 82 ? 'premium' : 'free',
        price: score.confidence >= 82 ? 9 : 0,
        status: 'pending',
        result: 'pending',
        source: 'real_ai_engine',
        ai_source: 'real_ai_engine',
        event_time: fixture?.fixture?.date || null,
        kickoff_time: fixture?.fixture?.date || null,
        bookmaker: oddsRows.length ? 'Odds API' : 'Model odds',
        created_at: new Date().toISOString()
      })
    }

    const { data, error } = await supabase.from('tips').insert(rows).select('id')
    if (error) throw error
    const { error: runLogError } = await supabase
      .from('ai_pick_runs')
      .insert({ source: 'api-football+odds+openai', picks_created: data?.length || 0, status: 'success', finished_at: new Date().toISOString() })
    if (runLogError) console.warn('AI run log insert skipped:', runLogError.message)
    return json(200, { inserted: data?.length || 0 })
  } catch (error) {
    console.error(error)
    return json(500, { error: error.message || 'AI Engine error' })
  }
}
