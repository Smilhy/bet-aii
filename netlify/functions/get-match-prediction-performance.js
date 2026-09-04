const { createClient } = require('@supabase/supabase-js')

const TABLE = 'match_prediction_snapshots'

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

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  try { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) } catch (_) { return null }
}

function n(value, fallback = 0) {
  const out = Number(value)
  return Number.isFinite(out) ? out : fallback
}
function pct(value) { return Math.max(0, Math.min(100, n(value, 0))) }
function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round((n(value, 0) + Number.EPSILON) * factor) / factor
}
function mean(values = []) {
  const clean = values.filter(Number.isFinite)
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0
}

const marketLabels = {
  oneXTwo: '1X2',
  over15: 'Over 1.5',
  over25: 'Over 2.5',
  over35: 'Over 3.5',
  btts: 'BTTS'
}

function outcomes(row) {
  const hg = Number(row?.actual_home_goals)
  const ag = Number(row?.actual_away_goals)
  if (!Number.isFinite(hg) || !Number.isFinite(ag)) return null
  const total = hg + ag
  return {
    home: hg > ag,
    draw: hg === ag,
    away: hg < ag,
    over15: total >= 2,
    over25: total >= 3,
    over35: total >= 4,
    btts: hg > 0 && ag > 0,
    score: { home: hg, away: ag }
  }
}

function predictionRecords(row) {
  const forecast = row?.forecast || {}
  const actual = outcomes(row)
  if (!actual) return []
  const one = forecast?.oneXTwo || {}
  const oneValues = [
    { key: 'home', probability: pct(one.home), actual: actual.home ? 1 : 0 },
    { key: 'draw', probability: pct(one.draw), actual: actual.draw ? 1 : 0 },
    { key: 'away', probability: pct(one.away), actual: actual.away ? 1 : 0 }
  ]
  const best1x2 = oneValues.reduce((best, item) => item.probability > best.probability ? item : best, oneValues[0] || { key: 'home', probability: 0, actual: 0 })
  const goals = forecast?.goals || {}
  const binaries = ['over15', 'over25', 'over35', 'btts'].map(key => {
    const probability = pct(goals[key])
    const yes = Boolean(actual[key])
    const predictedYes = probability >= 50
    const confidence = predictedYes ? probability : 100 - probability
    return {
      market: key,
      label: marketLabels[key],
      probability,
      actual: yes ? 1 : 0,
      confidence,
      correct: predictedYes === yes,
      brier: ((probability / 100) - (yes ? 1 : 0)) ** 2
    }
  })
  const pHome = pct(one.home) / 100
  const pDraw = pct(one.draw) / 100
  const pAway = pct(one.away) / 100
  const oneXTwoBrier = ((pHome - (actual.home ? 1 : 0)) ** 2 + (pDraw - (actual.draw ? 1 : 0)) ** 2 + (pAway - (actual.away ? 1 : 0)) ** 2) / 2
  const oneRecord = {
    market: 'oneXTwo',
    label: '1X2',
    probability: best1x2.probability,
    actual: best1x2.actual,
    confidence: best1x2.probability,
    correct: Boolean(best1x2.actual),
    brier: oneXTwoBrier,
    pick: best1x2.key
  }
  return [oneRecord, ...binaries]
}

function bucketName(confidence) {
  const c = Math.max(50, Math.min(99.999, n(confidence, 50)))
  const low = Math.floor(c / 5) * 5
  return `${low}-${Math.min(100, low + 5)}%`
}

function aggregateMarket(records, key) {
  const rows = records.filter(item => item.market === key)
  if (!rows.length) return { key, label: marketLabels[key] || key, samples: 0, accuracy: 0, brier: 0, avgConfidence: 0, calibration: [] }
  return {
    key,
    label: marketLabels[key] || key,
    samples: rows.length,
    accuracy: round(rows.filter(item => item.correct).length / rows.length * 100, 1),
    brier: round(mean(rows.map(item => item.brier)), 4),
    avgConfidence: round(mean(rows.map(item => item.confidence)), 1),
    calibration: calibration(rows)
  }
}

function calibration(records) {
  const map = new Map()
  for (const item of records) {
    if (!Number.isFinite(item.confidence)) continue
    const bucket = bucketName(item.confidence)
    if (!map.has(bucket)) map.set(bucket, [])
    map.get(bucket).push(item)
  }
  return [...map.entries()].map(([range, rows]) => ({
    range,
    samples: rows.length,
    avgConfidence: round(mean(rows.map(item => item.confidence)), 1),
    actualAccuracy: round(rows.filter(item => item.correct).length / rows.length * 100, 1),
    calibrationGap: round((rows.filter(item => item.correct).length / rows.length * 100) - mean(rows.map(item => item.confidence)), 1)
  })).sort((a, b) => Number(a.range.split('-')[0]) - Number(b.range.split('-')[0]))
}

function valueRecord(row) {
  const actual = outcomes(row)
  const value = row?.forecast?.value || {}
  const top = value?.top
  if (!actual || !value?.detected || !top) return null
  const key = String(top.key || '')
  const odds = n(top.bookmakerOdds, 0)
  const resultMap = {
    home: actual.home,
    draw: actual.draw,
    away: actual.away,
    over15: actual.over15,
    under15: !actual.over15,
    over25: actual.over25,
    under25: !actual.over25,
    over35: actual.over35,
    under35: !actual.over35,
    btts: actual.btts,
    bttsYes: actual.btts,
    bttsNo: !actual.btts
  }
  if (!(key in resultMap) || odds <= 1) return null
  const won = Boolean(resultMap[key])
  return {
    key,
    won,
    odds,
    edge: n(top.edgePp ?? top.edge, 0),
    profit: won ? odds - 1 : -1
  }
}

function aggregateRows(rows) {
  const records = rows.flatMap(predictionRecords)
  const values = rows.map(valueRecord).filter(Boolean)
  const markets = ['oneXTwo', 'over15', 'over25', 'over35', 'btts'].map(key => aggregateMarket(records, key))
  const overallCorrect = records.filter(item => item.correct).length
  const oneXTwo = markets.find(item => item.key === 'oneXTwo') || {}
  const valueProfit = values.reduce((sum, item) => sum + item.profit, 0)
  return {
    matches: rows.length,
    gradedPredictions: records.length,
    overallAccuracy: records.length ? round(overallCorrect / records.length * 100, 1) : 0,
    avgBrier: records.length ? round(mean(records.map(item => item.brier)), 4) : 0,
    oneXTwoAccuracy: n(oneXTwo.accuracy, 0),
    oneXTwoBrier: n(oneXTwo.brier, 0),
    valueBets: values.length,
    valueWins: values.filter(item => item.won).length,
    valueProfitUnits: round(valueProfit, 2),
    valueRoi: values.length ? round(valueProfit / values.length * 100, 1) : 0,
    avgRecordedEdge: values.length ? round(mean(values.map(item => item.edge)), 1) : 0,
    markets,
    calibration: calibration(records)
  }
}

function groupSummary(rows, keyFn, minSamples = 5) {
  const groups = new Map()
  for (const row of rows) {
    const key = String(keyFn(row) || '').trim()
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.entries()].map(([name, group]) => ({ name, ...aggregateRows(group) }))
    .filter(item => item.matches >= minSamples)
    .sort((a, b) => b.matches - a.matches || a.avgBrier - b.avgBrier)
}

async function fetchSettled(supabase, limit = 5000) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; from < limit; from += pageSize) {
    const to = Math.min(from + pageSize - 1, limit - 1)
    const { data, error } = await supabase
      .from(TABLE)
      .select('fixture_id,fixture_date,home_team,away_team,league,country,model_version,data_quality,source_count,consensus_agreement,forecast,actual_home_goals,actual_away_goals,settled_at')
      .not('actual_home_goals', 'is', null)
      .not('actual_away_goals', 'is', null)
      .order('settled_at', { ascending: false })
      .range(from, to)
    if (error) throw error
    const page = Array.isArray(data) ? data : []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

exports.handler = async function handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod && event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' })
  const supabase = getSupabase()
  if (!supabase) return json(503, { ok: false, available: false, error: 'Supabase ENV niedostępne' })
  try {
    const requested = Number(event.queryStringParameters?.limit || 5000)
    const limit = Math.max(100, Math.min(20000, Number.isFinite(requested) ? requested : 5000))
    const rows = await fetchSettled(supabase, limit)
    const now = Date.now()
    const last30 = rows.filter(row => {
      const t = Date.parse(row.settled_at || row.fixture_date || '')
      return Number.isFinite(t) && now - t <= 30 * 86400000
    })
    const all = aggregateRows(rows)
    const last30Stats = aggregateRows(last30)
    const leagues = groupSummary(rows, row => row.league, 8).slice(0, 20)
    const versions = groupSummary(rows, row => row.model_version, 3).slice(0, 12)
    return json(200, {
      ok: true,
      available: true,
      generatedAt: new Date().toISOString(),
      all,
      last30: last30Stats,
      leagues,
      versions,
      note: rows.length < 100 ? 'Mała próbka — wyniki kalibracji będą stabilniejsze po zebraniu większej liczby meczów.' : ''
    })
  } catch (error) {
    return json(500, { ok: false, available: false, error: error?.message || String(error) })
  }
}

exports._test = { outcomes, predictionRecords, aggregateRows, calibration, valueRecord }
