const { createClient } = require('@supabase/supabase-js')
const { apiGet: shieldApiGet, isRateLimitMessage } = require('./_lib/match-simulator-rate-shield')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
const TABLE = 'match_value_scan_snapshots'

let supabase = null
try {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
} catch (_) {}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  }
}

function clean(value = '', fallback = '') {
  const out = String(value == null ? '' : value).trim()
  return out || fallback
}
function num(value, fallback = 0) {
  const out = Number(String(value == null ? '' : value).replace(',', '.').replace('%', ''))
  return Number.isFinite(out) ? out : fallback
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, num(value, min))) }
function round(value, digits = 1) {
  const factor = 10 ** digits
  return Math.round((num(value, 0) + Number.EPSILON) * factor) / factor
}
function pct(value) { return clamp(value, 0, 100) }


async function apiGet(path, query = {}, options = {}) {
  // WERSJA 140: Value Scanner ma osobny, niski budżet. Gdy go wykorzysta,
  // pełna symulacja oraz pozostałe moduły strony nadal mają dostęp do API.
  return shieldApiGet(path, query, {
    budgetScope: 'value-scanner',
    budgetLimit: 240,
    totalBudgetLimit: 750,
    ...options
  })
}

async function readSnapshot(fixtureId) {
  if (!supabase || !fixtureId) return null
  try {
    const { data, error } = await supabase.from(TABLE)
      .select('fixture_id,fixture_date,home_team,away_team,league,country,payload,created_at,updated_at')
      .eq('fixture_id', String(fixtureId)).maybeSingle()
    if (error) throw error
    return data?.payload ? data : null
  } catch (_) { return null }
}

async function writeSnapshot(payload) {
  if (!supabase || !payload?.fixtureId) return false
  try {
    const row = {
      fixture_id: String(payload.fixtureId),
      fixture_date: payload.fixtureDate || null,
      home_team: clean(payload.home),
      away_team: clean(payload.away),
      league: clean(payload.league),
      country: clean(payload.country),
      payload,
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'fixture_id' })
    if (error) throw error
    return true
  } catch (_) { return false }
}

function cachedFresh(row) {
  const t = Date.parse(row?.updated_at || row?.created_at || '')
  if (!Number.isFinite(t)) return false
  return Date.now() - t < 4 * 60 * 1000
}

function normalizeRecent(rows = [], teamId) {
  return (rows || []).slice(0, 8).map(row => {
    const isHome = String(row?.teams?.home?.id || '') === String(teamId || '')
    const gf = isHome ? num(row?.goals?.home) : num(row?.goals?.away)
    const ga = isHome ? num(row?.goals?.away) : num(row?.goals?.home)
    return { gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D', venue: isHome ? 'H' : 'A' }
  })
}

function deriveStats(rows = []) {
  const sample = rows.slice(0, 8).filter(row => Number.isFinite(row.gf) && Number.isFinite(row.ga))
  if (sample.length < 5) return { available: false, sampleSize: sample.length }
  const goalsFor = sample.reduce((sum, row) => sum + row.gf, 0)
  const goalsAgainst = sample.reduce((sum, row) => sum + row.ga, 0)
  const points = sample.reduce((sum, row) => sum + (row.result === 'W' ? 3 : row.result === 'D' ? 1 : 0), 0)
  return {
    available: true,
    sampleSize: sample.length,
    goalsForAvg: goalsFor / sample.length,
    goalsAgainstAvg: goalsAgainst / sample.length,
    formScore: points / (sample.length * 3) * 100
  }
}

function normalizePrediction(row = {}) {
  const predictions = row?.predictions || {}
  const comparison = row?.comparison || {}
  const percent = {
    home: pct(predictions?.percent?.home),
    draw: pct(predictions?.percent?.draw),
    away: pct(predictions?.percent?.away)
  }
  const total = percent.home + percent.draw + percent.away
  return {
    available: total > 0,
    percent: total > 0 ? {
      home: percent.home / total * 100,
      draw: percent.draw / total * 100,
      away: percent.away / total * 100
    } : null,
    comparison: {
      attackHome: pct(comparison?.att?.home), attackAway: pct(comparison?.att?.away),
      defenceHome: pct(comparison?.def?.home), defenceAway: pct(comparison?.def?.away)
    }
  }
}

function factorial(n) {
  let out = 1
  for (let i = 2; i <= n; i += 1) out *= i
  return out
}
function poisson(lambda, k) { return Math.exp(-lambda) * (lambda ** k) / factorial(k) }

function poissonForecast(homeXg, awayXg) {
  const maxGoals = 8
  let home = 0, draw = 0, away = 0, over15 = 0, over25 = 0, over35 = 0, btts = 0
  const scores = []
  for (let h = 0; h <= maxGoals; h += 1) {
    for (let a = 0; a <= maxGoals; a += 1) {
      const p = poisson(homeXg, h) * poisson(awayXg, a)
      if (h > a) home += p
      else if (h === a) draw += p
      else away += p
      const total = h + a
      if (total >= 2) over15 += p
      if (total >= 3) over25 += p
      if (total >= 4) over35 += p
      if (h > 0 && a > 0) btts += p
      scores.push({ score: `${h}:${a}`, p })
    }
  }
  scores.sort((a, b) => b.p - a.p)
  return {
    oneXTwo: { home: home * 100, draw: draw * 100, away: away * 100 },
    goals: { over15: over15 * 100, over25: over25 * 100, over35: over35 * 100, btts: btts * 100 },
    topScores: scores.slice(0, 3).map(item => ({ score: item.score, probability: round(item.p * 100, 1) }))
  }
}

function blendTriplet(base, api, apiWeight = 0.24) {
  if (!api) return base
  const statWeight = 1 - apiWeight
  const mixed = {
    home: base.home * statWeight + api.home * apiWeight,
    draw: base.draw * statWeight + api.draw * apiWeight,
    away: base.away * statWeight + api.away * apiWeight
  }
  const sum = mixed.home + mixed.draw + mixed.away || 100
  return { home: mixed.home / sum * 100, draw: mixed.draw / sum * 100, away: mixed.away / sum * 100 }
}

function oddsValue(value) {
  const parsed = num(value, 0)
  return parsed > 1.001 && parsed < 100 ? parsed : 0
}
function isFullTimeBttsBet(name = '', id = null) {
  const lower = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (Number(id) === 8) return true
  if (!/(both teams (?:to )?score|btts|gg\/ng)/i.test(lower)) return false
  return !/(first half|1st half|second half|2nd half|both halves|over\/under|total goals|corners|cards|home team|away team)/i.test(lower)
}
function isFullTimeGoalsBet(name = '', id = null) {
  const lower = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (/(first half|1st half|second half|2nd half|home team|away team|corners|cards)/i.test(lower)) return false
  if (Number(id) === 5) return true
  return /(goals over\/under|goals over under|^over\/under$|total goals)/i.test(lower)
}

function normalizeOdds(rows = []) {
  const books = new Map()
  const ensureBook = name => {
    const key = clean(name, 'Bookmaker')
    if (!books.has(key)) books.set(key, { bookmaker: key })
    return books.get(key)
  }
  const setOdd = (book, key, odd) => {
    const value = oddsValue(odd)
    if (value && (!book[key] || value > book[key])) book[key] = round(value, 2)
  }
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const bookmaker of Array.isArray(row?.bookmakers) ? row.bookmakers : []) {
      const book = ensureBook(bookmaker?.name)
      for (const bet of Array.isArray(bookmaker?.bets) ? bookmaker.bets : []) {
        const betName = clean(bet?.name).toLowerCase()
        const betId = Number(bet?.id)
        const is1x2 = betId === 1 || ['match winner', 'winner', '1x2', 'fulltime result', 'full time result'].includes(betName)
        const isGoals = isFullTimeGoalsBet(bet?.name, bet?.id)
        const isBtts = isFullTimeBttsBet(bet?.name, bet?.id)
        if (!is1x2 && !isGoals && !isBtts) continue
        for (const value of Array.isArray(bet?.values) ? bet.values : []) {
          const raw = clean(value?.value)
          const lower = raw.toLowerCase()
          if (is1x2) {
            if (['home', '1'].includes(lower)) setOdd(book, 'home', value?.odd)
            else if (['draw', 'x'].includes(lower)) setOdd(book, 'draw', value?.odd)
            else if (['away', '2'].includes(lower)) setOdd(book, 'away', value?.odd)
          } else if (isBtts) {
            if (['yes', 'tak'].includes(lower)) setOdd(book, 'bttsYes', value?.odd)
            else if (['no', 'nie'].includes(lower)) setOdd(book, 'bttsNo', value?.odd)
          } else if (isGoals) {
            const m = raw.match(/^(over|under)\s*(\d+(?:[.,]\d+)?)/i)
            if (!m) continue
            const line = String(m[2]).replace(',', '.')
            if (!['1.5', '2.5', '3.5'].includes(line)) continue
            setOdd(book, `${m[1].toLowerCase()}${line.replace('.', '')}`, value?.odd)
          }
        }
      }
    }
  }
  return [...books.values()].filter(book => Object.keys(book).length > 1)
}

function marketGroup(key) {
  if (['home', 'draw', 'away'].includes(key)) return '1X2'
  if (['bttsYes', 'bttsNo'].includes(key)) return 'BTTS'
  if (/15/.test(key)) return 'O/U 1.5'
  if (/25/.test(key)) return 'O/U 2.5'
  if (/35/.test(key)) return 'O/U 3.5'
  return 'Rynek'
}

function valueCandidates(probabilities, books) {
  const model = {
    home: probabilities.oneXTwo.home, draw: probabilities.oneXTwo.draw, away: probabilities.oneXTwo.away,
    over15: probabilities.goals.over15, under15: 100 - probabilities.goals.over15,
    over25: probabilities.goals.over25, under25: 100 - probabilities.goals.over25,
    over35: probabilities.goals.over35, under35: 100 - probabilities.goals.over35,
    bttsYes: probabilities.goals.btts, bttsNo: 100 - probabilities.goals.btts
  }
  const candidates = []
  const add = (book, key, odd, denom) => {
    const price = oddsValue(odd)
    const probability = num(model[key], 0)
    if (!(price > 1) || !(probability > 0) || !(denom > 0)) return
    const noVig = (1 / price) / denom * 100
    const edge = probability - noVig
    const ev = probability / 100 * price - 1
    candidates.push({
      key, marketGroup: marketGroup(key), probability: round(probability, 1), fairOdds: round(100 / probability, 2),
      bookmakerOdds: round(price, 2), bookmaker: clean(book?.bookmaker, 'Bookmaker'),
      noVigImplied: round(noVig, 1), edgePp: round(edge, 1), expectedValuePct: round(ev * 100, 1),
      bookmakerMargin: round((denom - 1) * 100, 1)
    })
  }
  for (const book of books) {
    const h = num(book.home), d = num(book.draw), a = num(book.away)
    if (h > 1 && d > 1 && a > 1) {
      const denom = 1 / h + 1 / d + 1 / a
      add(book, 'home', h, denom); add(book, 'draw', d, denom); add(book, 'away', a, denom)
    }
    for (const line of ['15', '25', '35']) {
      const o = num(book[`over${line}`]), u = num(book[`under${line}`])
      if (o > 1 && u > 1) {
        const denom = 1 / o + 1 / u
        add(book, `over${line}`, o, denom); add(book, `under${line}`, u, denom)
      }
    }
    const yes = num(book.bttsYes), no = num(book.bttsNo)
    if (yes > 1 && no > 1) {
      const denom = 1 / yes + 1 / no
      add(book, 'bttsYes', yes, denom); add(book, 'bttsNo', no, denom)
    }
  }
  const byKey = new Map()
  for (const item of candidates) {
    const current = byKey.get(item.key)
    if (!current || item.edgePp > current.edgePp || (item.edgePp === current.edgePp && item.bookmakerOdds > current.bookmakerOdds)) byKey.set(item.key, item)
  }
  return [...byKey.values()].sort((a, b) => b.edgePp - a.edgePp || b.expectedValuePct - a.expectedValuePct)
}

function buildScan({ fixtureId, fixtureDate, home, away, league, country, recentHome, recentAway, prediction, oddsBooks }) {
  const homeStats = deriveStats(recentHome)
  const awayStats = deriveStats(recentAway)
  if (!homeStats.available || !awayStats.available) return null

  let homeXg = 0.46 * homeStats.goalsForAvg + 0.34 * awayStats.goalsAgainstAvg + 0.20 * 1.35 + 0.10
  let awayXg = 0.46 * awayStats.goalsForAvg + 0.34 * homeStats.goalsAgainstAvg + 0.20 * 1.15
  homeXg += (homeStats.formScore - awayStats.formScore) * 0.003
  awayXg += (awayStats.formScore - homeStats.formScore) * 0.003
  if (prediction?.available) {
    homeXg += (prediction.comparison.attackHome - prediction.comparison.defenceAway) * 0.004
    awayXg += (prediction.comparison.attackAway - prediction.comparison.defenceHome) * 0.004
  }
  homeXg = clamp(homeXg, 0.25, 3.4)
  awayXg = clamp(awayXg, 0.20, 3.2)

  const poisson = poissonForecast(homeXg, awayXg)
  const oneXTwo = blendTriplet(poisson.oneXTwo, prediction?.percent, prediction?.available ? 0.24 : 0)
  const probabilities = {
    oneXTwo: { home: round(oneXTwo.home, 1), draw: round(oneXTwo.draw, 1), away: round(oneXTwo.away, 1) },
    goals: {
      over15: round(poisson.goals.over15, 1), over25: round(poisson.goals.over25, 1),
      over35: round(poisson.goals.over35, 1), btts: round(poisson.goals.btts, 1)
    }
  }

  const avgDiff = prediction?.available
    ? (Math.abs(poisson.oneXTwo.home - prediction.percent.home) + Math.abs(poisson.oneXTwo.draw - prediction.percent.draw) + Math.abs(poisson.oneXTwo.away - prediction.percent.away)) / 3
    : 18
  const modelAgreement = round(clamp(100 - avgDiff * 2.2, 35, 98), 0)
  let dataQuality = 80
  dataQuality += Math.min(6, (homeStats.sampleSize - 5) * 2)
  dataQuality += Math.min(6, (awayStats.sampleSize - 5) * 2)
  if (prediction?.available) dataQuality += 5
  if (oddsBooks.length) dataQuality += 3
  dataQuality = Math.round(clamp(dataQuality, 0, 100))

  const candidates = valueCandidates(probabilities, oddsBooks)
  return {
    ok: true,
    version: 'BETAI_VALUE_SCANNER_V1',
    fixtureId: String(fixtureId), fixtureDate: fixtureDate || null,
    home, away, league, country,
    xg: { home: round(homeXg, 2), away: round(awayXg, 2) },
    probabilities,
    topScores: poisson.topScores,
    dataQuality,
    modelAgreement,
    sourceFlags: { recent: true, apiPrediction: Boolean(prediction?.available), realOdds: oddsBooks.length > 0 },
    bookmakerCount: oddsBooks.length,
    candidates: candidates.slice(0, 8),
    top: candidates[0] || null,
    generatedAt: new Date().toISOString()
  }
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod && event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' })
  const qs = event.queryStringParameters || {}
  const fixtureId = clean(qs.fixture || qs.fixture_id).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100)
  const homeTeamId = clean(qs.home_team_id || qs.homeTeamId).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100)
  const awayTeamId = clean(qs.away_team_id || qs.awayTeamId).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100)
  if (!fixtureId || !homeTeamId || !awayTeamId) return json(400, { ok: false, error: 'Brak fixture/team ids' })

  const cached = await readSnapshot(fixtureId)
  if (cached?.payload && cachedFresh(cached)) return json(200, { ...cached.payload, cached: true, cacheSource: 'supabase' })

  try {
    const [homeR, awayR, predictionR, oddsR] = await Promise.all([
      apiGet('/fixtures', { team: homeTeamId, last: 8 }, { ttlMs: 20 * 60 * 1000, attempts: 2 }),
      apiGet('/fixtures', { team: awayTeamId, last: 8 }, { ttlMs: 20 * 60 * 1000, attempts: 2 }),
      apiGet('/predictions', { fixture: fixtureId }, { ttlMs: 20 * 60 * 1000, attempts: 2 }),
      apiGet('/odds', { fixture: fixtureId, page: 1 }, { ttlMs: 4 * 60 * 1000, attempts: 2 })
    ])

    const rateLimited = [homeR, awayR, predictionR, oddsR].some(item => item?.rateLimited || isRateLimitMessage(item?.error))
    if ((!homeR.ok || !awayR.ok) && cached?.payload) return json(200, { ...cached.payload, cached: true, stale: true, rateLimited })
    if (!homeR.ok || !awayR.ok) return json(rateLimited ? 429 : 503, { ok: false, rateLimited, retryAfterMs: Math.max(...[homeR, awayR, predictionR, oddsR].map(item => num(item?.retryAfterMs))), error: 'Nie udało się pobrać formy obu drużyn.' })

    const recentHome = normalizeRecent(homeR.data || [], homeTeamId)
    const recentAway = normalizeRecent(awayR.data || [], awayTeamId)
    const prediction = normalizePrediction(predictionR.ok ? (predictionR.data?.[0] || {}) : {})
    const oddsBooks = normalizeOdds(oddsR.ok ? (oddsR.data || []) : [])
    const payload = buildScan({
      fixtureId,
      fixtureDate: clean(qs.fixture_date || qs.date) || null,
      home: clean(qs.home), away: clean(qs.away), league: clean(qs.league), country: clean(qs.country),
      recentHome, recentAway, prediction, oddsBooks
    })
    if (!payload) return json(422, { ok: false, error: 'Za mało danych formy do skanera.' })
    await writeSnapshot(payload)
    return json(200, {
      ...payload,
      cached: Boolean([homeR, awayR, predictionR, oddsR].filter(item => item?.fromCache).length),
      rateLimitShield: {
        cachedResponses: [homeR, awayR, predictionR, oddsR].filter(item => item?.fromCache).length,
        rateLimited
      }
    })
  } catch (error) {
    if (cached?.payload) return json(200, { ...cached.payload, cached: true, stale: true })
    return json(500, { ok: false, error: error?.message || String(error) })
  }
}

exports._test = { deriveStats, poissonForecast, valueCandidates, buildScan }
