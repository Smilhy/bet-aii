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

function predictionRecords(row, mode = 'calibrated') {
  const forecast = row?.forecast || {}
  const source = mode === 'raw' && forecast?.raw ? forecast.raw : forecast
  const actual = outcomes(row)
  if (!actual) return []
  const one = source?.oneXTwo || forecast?.oneXTwo || {}
  const oneValues = [
    { key: 'home', probability: pct(one.home), actual: actual.home ? 1 : 0 },
    { key: 'draw', probability: pct(one.draw), actual: actual.draw ? 1 : 0 },
    { key: 'away', probability: pct(one.away), actual: actual.away ? 1 : 0 }
  ]
  const best1x2 = oneValues.reduce((best, item) => item.probability > best.probability ? item : best, oneValues[0] || { key: 'home', probability: 0, actual: 0 })
  const goals = source?.goals || forecast?.goals || {}
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
  const records = rows.flatMap(row => predictionRecords(row, 'calibrated'))
  const rawRecords = rows.flatMap(row => predictionRecords(row, 'raw'))
  const values = rows.map(valueRecord).filter(Boolean)
  const markets = ['oneXTwo', 'over15', 'over25', 'over35', 'btts'].map(key => aggregateMarket(records, key))
  const rawMarkets = ['oneXTwo', 'over15', 'over25', 'over35', 'btts'].map(key => aggregateMarket(rawRecords, key))
  const overallCorrect = records.filter(item => item.correct).length
  const oneXTwo = markets.find(item => item.key === 'oneXTwo') || {}
  const rawBrier = rawRecords.length ? mean(rawRecords.map(item => item.brier)) : 0
  const calibratedBrier = records.length ? mean(records.map(item => item.brier)) : 0
  const valueProfit = values.reduce((sum, item) => sum + item.profit, 0)
  const clvRows = rows.map(row => row?.settlement?.clv).filter(item => item && item.qualifiedClosing && Number.isFinite(Number(item.clvPct)))
  return {
    matches: rows.length,
    gradedPredictions: records.length,
    overallAccuracy: records.length ? round(overallCorrect / records.length * 100, 1) : 0,
    avgBrier: records.length ? round(calibratedBrier, 4) : 0,
    rawAvgBrier: rawRecords.length ? round(rawBrier, 4) : 0,
    calibrationBrierLift: rawRecords.length ? round(rawBrier - calibratedBrier, 4) : 0,
    oneXTwoAccuracy: n(oneXTwo.accuracy, 0),
    oneXTwoBrier: n(oneXTwo.brier, 0),
    valueBets: values.length,
    valueWins: values.filter(item => item.won).length,
    valueProfitUnits: round(valueProfit, 2),
    valueRoi: values.length ? round(valueProfit / values.length * 100, 1) : 0,
    avgRecordedEdge: values.length ? round(mean(values.map(item => item.edge)), 1) : 0,
    clvSamples: clvRows.length,
    avgClv: clvRows.length ? round(mean(clvRows.map(item => Number(item.clvPct))), 1) : 0,
    positiveClvRate: clvRows.length ? round(clvRows.filter(item => Number(item.clvPct) > 0).length / clvRows.length * 100, 1) : 0,
    markets,
    rawMarkets,
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, n(value, min)))
}

function rowTime(row = {}) {
  const t = Date.parse(row.fixture_date || row.settled_at || '')
  return Number.isFinite(t) ? t : 0
}

function walkForwardBacktest(rows = []) {
  const chronological = [...rows].sort((a, b) => rowTime(a) - rowTime(b))
  const marketKeys = ['oneXTwo', 'over15', 'over25', 'over35', 'btts']
  const histories = Object.fromEntries(marketKeys.map(key => [key, []]))
  const results = Object.fromEntries(marketKeys.map(key => [key, []]))

  for (const row of chronological) {
    const currentRecords = predictionRecords(row, 'raw')
    for (const current of currentRecords) {
      const history = histories[current.market] || []
      if (history.length >= 30) {
        const targetBucket = bucketName(current.confidence)
        const bucketRows = history.filter(item => bucketName(item.confidence) === targetBucket)
        const calibrationRows = bucketRows.length >= 10 ? bucketRows : history.slice(-120)
        const actualAccuracy = calibrationRows.length
          ? calibrationRows.filter(item => item.correct).length / calibrationRows.length * 100
          : current.confidence
        const historyWeight = clamp(0.18 + Math.min(0.42, calibrationRows.length / 220), 0.18, 0.60)
        const calibratedConfidence = clamp(current.confidence * (1 - historyWeight) + actualAccuracy * historyWeight, 50.01, 96.5)
        const predictedYes = current.probability >= 50
        const calibratedProbability = current.market === 'oneXTwo'
          ? calibratedConfidence
          : (predictedYes ? calibratedConfidence : 100 - calibratedConfidence)
        const actual = n(current.actual, 0)
        const rawProbability = current.market === 'oneXTwo' ? current.confidence : current.probability
        const rawBrier = ((rawProbability / 100) - actual) ** 2
        const wfBrier = ((calibratedProbability / 100) - actual) ** 2
        results[current.market].push({
          rawBrier,
          walkForwardBrier: wfBrier,
          correct: (calibratedProbability >= 50) === Boolean(actual),
          rawProbability,
          calibratedProbability,
          historySamples: history.length,
          bucketSamples: bucketRows.length
        })
      }
      histories[current.market].push(current)
    }
  }

  const markets = marketKeys.map(key => {
    const list = results[key] || []
    const rawBrier = list.length ? mean(list.map(item => item.rawBrier)) : 0
    const wfBrier = list.length ? mean(list.map(item => item.walkForwardBrier)) : 0
    return {
      key,
      label: marketLabels[key] || key,
      samples: list.length,
      rawBrier: round(rawBrier, 4),
      walkForwardBrier: round(wfBrier, 4),
      lift: round(rawBrier - wfBrier, 4),
      accuracy: list.length ? round(list.filter(item => item.correct).length / list.length * 100, 1) : 0,
      avgHistorySamples: list.length ? round(mean(list.map(item => item.historySamples)), 1) : 0
    }
  })
  const allRows = markets.filter(item => item.samples > 0)
  const totalSamples = allRows.reduce((sum, item) => sum + item.samples, 0)
  const rawWeighted = totalSamples ? allRows.reduce((sum, item) => sum + item.rawBrier * item.samples, 0) / totalSamples : 0
  const wfWeighted = totalSamples ? allRows.reduce((sum, item) => sum + item.walkForwardBrier * item.samples, 0) / totalSamples : 0
  return {
    samples: totalSamples,
    rawBrier: round(rawWeighted, 4),
    walkForwardBrier: round(wfWeighted, 4),
    lift: round(rawWeighted - wfWeighted, 4),
    markets
  }
}

function marketWindowStats(rows = [], key = '', size = 30) {
  const selected = rows.slice(0, size)
  const records = selected.flatMap(row => predictionRecords(row, 'calibrated')).filter(item => item.market === key)
  if (!records.length) return { samples: 0, brier: 0, accuracy: 0 }
  return {
    samples: records.length,
    brier: round(mean(records.map(item => item.brier)), 4),
    accuracy: round(records.filter(item => item.correct).length / records.length * 100, 1)
  }
}

function buildDriftDetector(rows = []) {
  const newest = [...rows].sort((a, b) => rowTime(b) - rowTime(a))
  const baseline = aggregateRows(newest)
  const markets = ['oneXTwo', 'over15', 'over25', 'over35', 'btts'].map(key => {
    const base = baseline.markets.find(item => item.key === key) || { samples: 0, brier: 0, accuracy: 0 }
    const w30 = marketWindowStats(newest, key, 30)
    const w50 = marketWindowStats(newest, key, 50)
    const w100 = marketWindowStats(newest, key, 100)
    const current = w30.samples >= 20 ? w30 : w50.samples >= 30 ? w50 : w100
    const deltaBrier = current.samples && base.samples ? current.brier - n(base.brier, 0) : 0
    const deltaAccuracy = current.samples && base.samples ? current.accuracy - n(base.accuracy, 0) : 0
    let status = 'PENDING'
    let score = 50
    if (current.samples >= 20 && base.samples >= 30) {
      if (deltaBrier >= 0.045 || deltaAccuracy <= -10) { status = 'DRIFT'; score = 28 }
      else if (deltaBrier >= 0.022 || deltaAccuracy <= -5) { status = 'WATCH'; score = 66 }
      else { status = 'STABLE'; score = 90 }
      if (deltaBrier < -0.02 && deltaAccuracy > 3) score = Math.min(98, score + 5)
    }
    return {
      key, label: marketLabels[key] || key, status, score,
      baseline: { samples: n(base.samples), brier: n(base.brier), accuracy: n(base.accuracy) },
      deltaBrier: round(deltaBrier, 4), deltaAccuracy: round(deltaAccuracy, 1),
      windows: { w30, w50, w100 }
    }
  })
  return { markets }
}

function averageCalibrationGap(market = {}) {
  const rows = Array.isArray(market?.calibration) ? market.calibration.filter(item => n(item.samples) >= 5) : []
  return rows.length ? mean(rows.map(item => Math.abs(n(item.calibrationGap)))) : 10
}

function trustScoreForMarket(market = {}, drift = null) {
  const samples = n(market?.samples)
  if (!samples) return { score: 35, label: 'PENDING', samples: 0 }
  const sampleScore = clamp(samples / 180 * 100, 15, 100)
  const brier = n(market?.brier, 0.30)
  const brierScore = clamp(100 - Math.max(0, brier - 0.16) * 330, 10, 100)
  const gap = averageCalibrationGap(market)
  const calibrationScore = clamp(100 - gap * 7, 15, 100)
  let score = sampleScore * 0.30 + brierScore * 0.45 + calibrationScore * 0.25
  if (drift?.status === 'WATCH') score -= 8
  if (drift?.status === 'DRIFT') score -= 22
  score = Math.round(clamp(score, 0, 100))
  const label = score >= 82 ? 'HIGH' : score >= 68 ? 'GOOD' : score >= 55 ? 'CAUTION' : 'LOW'
  return { score, label, samples, brier: round(brier, 4), calibrationGap: round(gap, 1) }
}

function buildLeagueTrust(rows = []) {
  const groups = new Map()
  for (const row of rows) {
    const league = String(row?.league || '').trim()
    if (!league) continue
    if (!groups.has(league)) groups.set(league, [])
    groups.get(league).push(row)
  }
  const output = []
  for (const [name, group] of groups.entries()) {
    if (group.length < 8) continue
    const summary = aggregateRows(group)
    const drift = buildDriftDetector(group)
    const markets = summary.markets.map(market => {
      const driftMarket = drift.markets.find(item => item.key === market.key)
      return { key: market.key, label: market.label, ...trustScoreForMarket(market, driftMarket), driftStatus: driftMarket?.status || 'PENDING' }
    })
    const weighted = markets.filter(item => item.samples > 0)
    const overallScore = weighted.length ? Math.round(mean(weighted.map(item => item.score))) : 35
    const label = overallScore >= 82 ? 'HIGH' : overallScore >= 68 ? 'GOOD' : overallScore >= 55 ? 'CAUTION' : 'LOW'
    output.push({ name, matches: group.length, overallScore, label, markets })
  }
  return output.sort((a, b) => b.overallScore - a.overallScore || b.matches - a.matches).slice(0, 30)
}

function streakStats(settled = []) {
  let currentWin = 0, currentLose = 0, maxWin = 0, maxLose = 0
  for (const row of settled) {
    if (row.status === 'won') {
      currentWin += 1; currentLose = 0; maxWin = Math.max(maxWin, currentWin)
    } else if (row.status === 'lost') {
      currentLose += 1; currentWin = 0; maxLose = Math.max(maxLose, currentLose)
    }
  }
  return { maxWinStreak: maxWin, maxLoseStreak: maxLose }
}

function aggregateShadowPortfolio(rows = []) {
  const settled = [...rows].filter(row => ['won', 'lost'].includes(String(row?.status || '').toLowerCase())).sort((a, b) => Date.parse(a.created_at || '') - Date.parse(b.created_at || ''))
  const pending = rows.filter(row => String(row?.status || '').toLowerCase() === 'pending').length
  let equity = 0, peak = 0, maxDrawdown = 0
  for (const row of settled) {
    equity += n(row.profit_units)
    peak = Math.max(peak, equity)
    maxDrawdown = Math.max(maxDrawdown, peak - equity)
  }
  const totalStake = settled.reduce((sum, row) => sum + Math.max(0, n(row.stake_units, 1)), 0)
  const profit = settled.reduce((sum, row) => sum + n(row.profit_units), 0)
  const clv = settled.map(row => Number(row.clv_pct)).filter(Number.isFinite)
  const streaks = streakStats(settled)
  return {
    bets: rows.length,
    settled: settled.length,
    pending,
    wins: settled.filter(row => row.status === 'won').length,
    losses: settled.filter(row => row.status === 'lost').length,
    profitUnits: round(profit, 2),
    roi: totalStake ? round(profit / totalStake * 100, 1) : 0,
    yield: totalStake ? round(profit / totalStake * 100, 1) : 0,
    maxDrawdownUnits: round(maxDrawdown, 2),
    maxWinStreak: streaks.maxWinStreak,
    maxLoseStreak: streaks.maxLoseStreak,
    avgClv: clv.length ? round(mean(clv), 1) : 0,
    clvSamples: clv.length
  }
}


function quantileV157(values = [], q = 0.5) {
  const rows = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!rows.length) return 0
  const pos = (rows.length - 1) * Math.max(0, Math.min(1, q))
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  if (lo === hi) return rows[lo]
  return rows[lo] + (rows[hi] - rows[lo]) * (pos - lo)
}

function seededRandomV157(seed = 123456789) {
  let state = (Number(seed) >>> 0) || 123456789
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 4294967296
  }
}

function buildPortfolioRiskSimulatorV157(rows = [], simulations = 1000) {
  const settled = rows.filter(row => ['won', 'lost'].includes(String(row?.status || '').toLowerCase()))
  const returns = settled.map(row => {
    const stake = Math.max(0.01, n(row?.stake_units, 1))
    return n(row?.profit_units, 0) / stake
  }).filter(Number.isFinite)
  if (returns.length < 30) return { available: false, status: 'PENDING', samples: returns.length, simulations: 0, horizons: [] }

  const rng = seededRandomV157(0xB37A1 + returns.length * 97)
  const horizons = [50, 100, 250].map(horizon => {
    const rois = [], drawdowns = []
    for (let sim = 0; sim < simulations; sim += 1) {
      let equity = 0, peak = 0, maxDrawdown = 0
      for (let i = 0; i < horizon; i += 1) {
        const sample = returns[Math.floor(rng() * returns.length)]
        equity += sample
        peak = Math.max(peak, equity)
        maxDrawdown = Math.max(maxDrawdown, peak - equity)
      }
      rois.push(equity / horizon * 100)
      drawdowns.push(maxDrawdown)
    }
    return {
      horizon,
      medianRoi: round(quantileV157(rois, 0.50), 1),
      p10Roi: round(quantileV157(rois, 0.10), 1),
      p90Roi: round(quantileV157(rois, 0.90), 1),
      medianDrawdown: round(quantileV157(drawdowns, 0.50), 1),
      p90Drawdown: round(quantileV157(drawdowns, 0.90), 1)
    }
  })
  return { available: true, status: 'READY', samples: returns.length, simulations, horizons, method: 'bootstrap historical 1u returns' }
}

async function fetchErrorAnalysisV154(supabase, limit = 1000) {
  const { data, error } = await supabase
    .from('match_prediction_error_analysis')
    .select('fixture_id,classification,severity,summary,market_key,league,clv_pct,created_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(50, Math.min(5000, limit)))
  if (error) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message || ''))) return { total: 0, categories: [], recent: [] }
    throw error
  }
  const rows = Array.isArray(data) ? data : []
  const map = new Map()
  for (const row of rows) {
    const key = String(row?.classification || 'OTHER')
    map.set(key, (map.get(key) || 0) + 1)
  }
  const categories = [...map.entries()].map(([classification, count]) => ({ classification, count })).sort((a, b) => b.count - a.count)
  return {
    total: rows.length,
    categories,
    recent: rows.slice(0, 12).map(row => ({
      fixtureId: row.fixture_id,
      classification: row.classification,
      severity: row.severity,
      summary: row.summary,
      marketKey: row.market_key,
      league: row.league,
      clvPct: row.clv_pct,
      createdAt: row.created_at
    }))
  }
}

async function fetchShadowBets(supabase, limit = 5000) {
  const { data, error } = await supabase
    .from('match_shadow_bets')
    .select('fixture_id,market_key,odds,stake_units,status,profit_units,clv_pct,created_at,settled_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(100, Math.min(10000, limit)))
  if (error) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message || ''))) return []
    throw error
  }
  return Array.isArray(data) ? data : []
}

async function fetchSettled(supabase, limit = 5000) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; from < limit; from += pageSize) {
    const to = Math.min(from + pageSize - 1, limit - 1)
    const { data, error } = await supabase
      .from(TABLE)
      .select('fixture_id,fixture_date,home_team,away_team,league,country,model_version,data_quality,source_count,consensus_agreement,forecast,settlement,actual_home_goals,actual_away_goals,settled_at')
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
    const walkForward = walkForwardBacktest(rows)
    const drift = buildDriftDetector(rows)
    const leagueTrust = buildLeagueTrust(rows)
    let shadowRows = []
    let paperPortfolio = aggregateShadowPortfolio([])
    let portfolioRisk = buildPortfolioRiskSimulatorV157([])
    try {
      shadowRows = await fetchShadowBets(supabase, 5000)
      paperPortfolio = aggregateShadowPortfolio(shadowRows)
      portfolioRisk = buildPortfolioRiskSimulatorV157(shadowRows, 1000)
    } catch (_) {}
    let errorAnalysis = { total: 0, categories: [], recent: [] }
    try { errorAnalysis = await fetchErrorAnalysisV154(supabase, 1000) } catch (_) {}
    return json(200, {
      ok: true,
      available: true,
      generatedAt: new Date().toISOString(),
      all,
      last30: last30Stats,
      leagues,
      versions,
      walkForward,
      drift,
      leagueTrust,
      paperPortfolio,
      portfolioRisk,
      errorAnalysis,
      note: rows.length < 100 ? 'Mała próbka — wyniki kalibracji, drift, trust score i risk simulator będą stabilniejsze po zebraniu większej liczby meczów.' : ''
    })
  } catch (error) {
    return json(500, { ok: false, available: false, error: error?.message || String(error) })
  }
}

exports._test = { outcomes, predictionRecords, aggregateRows, calibration, valueRecord, walkForwardBacktest, buildDriftDetector, buildLeagueTrust, aggregateShadowPortfolio, buildPortfolioRiskSimulatorV157 }
