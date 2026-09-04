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


async function fetchModelExperimentsV160(supabase, limit = 10000) {
  const { data, error } = await supabase
    .from('match_model_experiments')
    .select('fixture_id,fixture_date,home_team,away_team,league,country,model_role,model_version,active_at_capture,data_quality,forecast,status,actual_home_goals,actual_away_goals,settled_at')
    .eq('status', 'settled')
    .not('actual_home_goals', 'is', null)
    .not('actual_away_goals', 'is', null)
    .order('settled_at', { ascending: false })
    .limit(Math.max(100, Math.min(20000, limit)))
  if (error) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message || ''))) return []
    throw error
  }
  return Array.isArray(data) ? data : []
}

function aggregateVariantRows(rows = [], variantResolver = null) {
  const records = []
  for (const row of rows) {
    const variant = typeof variantResolver === 'function' ? variantResolver(row) : row?.forecast
    if (!variant) continue
    records.push(...predictionRecords({ ...row, forecast: variant }, 'calibrated'))
  }
  const markets = ['oneXTwo', 'over15', 'over25', 'over35', 'btts'].map(key => aggregateMarket(records, key))
  return {
    matches: rows.length,
    gradedPredictions: records.length,
    avgBrier: records.length ? round(mean(records.map(item => item.brier)), 4) : 0,
    accuracy: records.length ? round(records.filter(item => item.correct).length / records.length * 100, 1) : 0,
    markets
  }
}

function buildChampionChallengerV160(snapshotRows = [], experimentRows = []) {
  const pairs = []
  if (Array.isArray(experimentRows) && experimentRows.length) {
    const grouped = new Map()
    for (const row of experimentRows) {
      const key = String(row?.fixture_id || '')
      if (!key) continue
      if (!grouped.has(key)) grouped.set(key, {})
      grouped.get(key)[String(row?.model_role || '').toLowerCase()] = row
    }
    for (const [fixtureId, group] of grouped.entries()) {
      if (!group.champion || !group.challenger) continue
      pairs.push({ fixtureId, champion: group.champion, challenger: group.challenger })
    }
  }
  if (!pairs.length) {
    for (const row of snapshotRows) {
      const champion = row?.forecast?.modelVariants?.champion
      const challenger = row?.forecast?.modelVariants?.challenger
      if (!champion || !challenger) continue
      pairs.push({
        fixtureId: row.fixture_id,
        champion: { ...row, forecast: champion },
        challenger: { ...row, forecast: challenger }
      })
    }
  }
  const championRows = pairs.map(pair => ({ ...pair.champion, forecast: pair.champion?.forecast || pair.champion }))
  const challengerRows = pairs.map(pair => ({ ...pair.challenger, forecast: pair.challenger?.forecast || pair.challenger }))
  const champion = aggregateVariantRows(championRows)
  const challenger = aggregateVariantRows(challengerRows)
  const pairedSamples = pairs.length
  const brierDelta = pairedSamples ? round(n(champion.avgBrier) - n(challenger.avgBrier), 4) : 0
  const marketRegressions = challenger.markets.filter(item => {
    const base = champion.markets.find(row => row.key === item.key)
    return n(item.samples) >= 50 && n(base?.samples) >= 50 && n(item.brier) > n(base?.brier) + 0.015
  })
  let activeModel = 'champion'
  let status = pairedSamples ? 'LEARNING' : 'COLLECTING'
  let reason = `Challenger ma ${pairedSamples}/100 rozliczonych par. Champion pozostaje aktywny.`
  if (pairedSamples >= 100) {
    if (brierDelta >= 0.005 && !marketRegressions.length) {
      activeModel = 'challenger'
      status = 'CHALLENGER_PROMOTED'
      reason = `Challenger obniża Brier o ${brierDelta.toFixed(4)} przy ${pairedSamples} porównaniach i nie ma istotnej regresji rynkowej.`
    } else if (brierDelta <= -0.005) {
      status = 'CHAMPION_WIN'
      reason = `Champion pozostaje lepszy o ${Math.abs(brierDelta).toFixed(4)} Brier przy ${pairedSamples} porównaniach.`
    } else {
      status = 'NO_CLEAR_WINNER'
      reason = `Brak wystarczającej przewagi jakościowej. Wymagamy co najmniej 0.005 poprawy Brier bez regresji rynków.`
    }
  }
  return {
    version: 'BETAI_CHAMPION_CHALLENGER_V160',
    activeModel,
    status,
    reason,
    pairedSamples,
    requiredSamples: 100,
    promotionBrierLift: 0.005,
    brierDelta,
    champion: { version: 'BETAI_CHAMPION_V158_CORE', ...champion },
    challenger: { version: 'BETAI_CHALLENGER_V166_DC_STRENGTH', ...challenger },
    marketRegressions: marketRegressions.map(item => item.key)
  }
}

function wilsonInterval(successes = 0, total = 0, z = 1.96) {
  const nTotal = Math.max(0, Number(total || 0))
  if (!nTotal) return null
  const p = Math.max(0, Math.min(1, Number(successes || 0) / nTotal))
  const z2 = z * z
  const denominator = 1 + z2 / nTotal
  const center = (p + z2 / (2 * nTotal)) / denominator
  const margin = z * Math.sqrt((p * (1 - p) / nTotal) + (z2 / (4 * nTotal * nTotal))) / denominator
  return { low: round(Math.max(0, center - margin) * 100, 1), high: round(Math.min(1, center + margin) * 100, 1) }
}

function buildStatisticalConfidenceV161(all = {}, shadowRows = []) {
  const markets = (all?.markets || []).map(market => {
    const samples = n(market?.samples)
    const successes = Math.round(samples * n(market?.accuracy) / 100)
    const accuracy95 = wilsonInterval(successes, samples)
    const width = accuracy95 ? accuracy95.high - accuracy95.low : 100
    const level = samples >= 250 && width <= 12 ? 'HIGH' : samples >= 100 ? 'MEDIUM' : samples >= 30 ? 'LOW' : 'PENDING'
    return { key: market.key, label: market.label, samples, accuracy: n(market.accuracy), brier: n(market.brier), accuracy95, level }
  })
  const settled = shadowRows.filter(row => ['won','lost'].includes(String(row?.status || '').toLowerCase()))
  const returns = settled.map(row => {
    const stake = Math.max(.01, n(row?.stake_units, 1))
    return n(row?.profit_units) / stake
  })
  const roi = returns.length ? mean(returns) * 100 : 0
  const sd = stddev(returns)
  const se = returns.length ? sd / Math.sqrt(returns.length) : 0
  const roi95 = returns.length ? { low: round((mean(returns) - 1.96 * se) * 100, 1), high: round((mean(returns) + 1.96 * se) * 100, 1) } : null
  const portfolioLevel = returns.length >= 250 && roi95?.low > 0 ? 'HIGH' : returns.length >= 100 ? 'MEDIUM' : returns.length >= 30 ? 'LOW' : 'PENDING'
  return {
    version: 'BETAI_STAT_CONFIDENCE_V161',
    markets,
    portfolio: { samples: returns.length, roi: round(roi, 1), roi95, standardDeviationUnits: round(sd, 3), level: portfolioLevel }
  }
}

function buildAutoGateV162(all = {}, drift = {}) {
  const rows = (all?.markets || []).map(market => {
    const driftRow = (drift?.markets || []).find(item => item.key === market.key) || null
    const trust = trustScoreForMarket(market, driftRow)
    const samples = n(market.samples)
    const brier = n(market.brier)
    const driftStatus = String(driftRow?.status || 'PENDING').toUpperCase()
    let status = 'ACTIVE'
    let reason = 'Historyczna jakość rynku jest stabilna.'
    if (samples < 30) {
      status = 'WATCH'
      reason = `Za mała próbka: ${samples}/30.`
    } else if (driftStatus === 'DRIFT' || (samples >= 50 && brier >= .30) || (samples >= 50 && trust.score < 45)) {
      status = 'BLOCKED'
      reason = driftStatus === 'DRIFT' ? 'Wykryto MODEL DRIFT.' : brier >= .30 ? `Brier ${brier.toFixed(3)} przekracza limit.` : `Trust Score ${trust.score}/100 jest zbyt niski.`
    } else if (driftStatus === 'WATCH' || brier >= .265 || trust.score < 60) {
      status = 'WATCH'
      reason = driftStatus === 'WATCH' ? 'Rynek ma status DRIFT WATCH.' : brier >= .265 ? `Brier ${brier.toFixed(3)} wymaga obserwacji.` : `Trust Score ${trust.score}/100 wymaga obserwacji.`
    }
    return { key: market.key, label: market.label, status, reason, samples, brier: round(brier, 4), driftStatus, trustScore: trust.score }
  })
  return {
    version: 'BETAI_AUTO_GATE_V162',
    markets: rows,
    blocked: rows.filter(item => item.status === 'BLOCKED').map(item => item.key),
    watch: rows.filter(item => item.status === 'WATCH').map(item => item.key)
  }
}

function buildTeamStrengthV164(rows = []) {
  const ratings = new Map()
  const stats = new Map()
  const get = team => ratings.has(team) ? ratings.get(team) : 1500
  const touch = team => {
    if (!stats.has(team)) stats.set(team, { team, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 })
    return stats.get(team)
  }
  const chronological = [...rows].sort((a, b) => rowTime(a) - rowTime(b))
  for (const row of chronological) {
    const home = String(row?.home_team || '').trim()
    const away = String(row?.away_team || '').trim()
    const hg = Number(row?.actual_home_goals)
    const ag = Number(row?.actual_away_goals)
    if (!home || !away || !Number.isFinite(hg) || !Number.isFinite(ag)) continue
    const rh = get(home), ra = get(away)
    const expectedHome = 1 / (1 + Math.pow(10, -((rh + 55) - ra) / 400))
    const actualHome = hg > ag ? 1 : hg === ag ? .5 : 0
    const margin = 1 + Math.log1p(Math.abs(hg - ag)) * .28
    const k = 20 * margin
    ratings.set(home, rh + k * (actualHome - expectedHome))
    ratings.set(away, ra + k * ((1 - actualHome) - (1 - expectedHome)))
    const hs = touch(home), as = touch(away)
    hs.matches += 1; as.matches += 1
    hs.goalsFor += hg; hs.goalsAgainst += ag; as.goalsFor += ag; as.goalsAgainst += hg
    if (hg > ag) { hs.wins += 1; as.losses += 1 }
    else if (hg < ag) { as.wins += 1; hs.losses += 1 }
    else { hs.draws += 1; as.draws += 1 }
  }
  const teams = [...stats.values()].map(item => ({
    ...item,
    rating: Math.round(get(item.team)),
    ppg: item.matches ? round((item.wins * 3 + item.draws) / item.matches, 2) : 0,
    goalDiffPerMatch: item.matches ? round((item.goalsFor - item.goalsAgainst) / item.matches, 2) : 0
  })).sort((a, b) => b.matches - a.matches || b.rating - a.rating).slice(0, 800)
  return { version: 'BETAI_TEAM_STRENGTH_V164', method: 'Opponent-adjusted Elo from settled Bet+AI fixtures', teams, trackedTeams: stats.size }
}



// WERSJA 154 / 157 / 158 — walidacja modelu, analiza błędów i risk lab.
function resultForMarketKey(row = {}, key = '') {
  const actual = outcomes(row)
  if (!actual) return null
  const map = {
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
  return Object.prototype.hasOwnProperty.call(map, key) ? Boolean(map[key]) : null
}

function primaryDecisionCandidate(row = {}) {
  const forecast = row?.forecast || {}
  const card = forecast?.professionalLab?.decisionCard || forecast?.validationRiskLab?.decisionCard || null
  if (card?.key) return {
    key: String(card.key),
    label: String(card.label || card.key),
    probability: n(card.conservativeProbability ?? card.calibratedProbability ?? card.rawProbability, 0),
    rawProbability: n(card.rawProbability, 0),
    edge: n(card.conservativeEdgePp ?? card.rawEdgePp, 0),
    decision: String(card.decision || ''),
    driftStatus: String(card.driftStatus || forecast?.professionalLab?.drift?.status || 'PENDING')
  }
  const top = forecast?.value?.top || forecast?.value?.top3?.[0] || null
  if (!top?.key) return null
  return {
    key: String(top.key),
    label: String(top.label || top.key),
    probability: n(top.probability, 0),
    rawProbability: n(top.probability, 0),
    edge: n(top.edgePp ?? top.edge, 0),
    decision: String(top.decision || forecast?.value?.state || ''),
    driftStatus: String(forecast?.professionalLab?.drift?.status || 'PENDING')
  }
}

function buildErrorAnalysis(rows = []) {
  const errors = []
  const categoryCounts = new Map()
  const addCategory = (key, label) => categoryCounts.set(key, { key, label, count: (categoryCounts.get(key)?.count || 0) + 1 })

  for (const row of rows) {
    const candidate = primaryDecisionCandidate(row)
    if (!candidate?.key) continue
    const won = resultForMarketKey(row, candidate.key)
    if (won == null || won) continue

    const categories = []
    const quality = n(row?.data_quality)
    const sourceCount = n(row?.source_count)
    const consensusAgreement = n(row?.consensus_agreement)
    const clv = n(row?.settlement?.clv?.clvPct, NaN)
    const disagreement = String(row?.forecast?.ensembleValidation?.disagreement?.status || row?.forecast?.validationRiskLab?.ensemble?.disagreement?.status || '').toUpperCase()

    if (quality < 75) { categories.push('LOW_DATA_QUALITY'); addCategory('LOW_DATA_QUALITY', 'Niska jakość danych') }
    if (sourceCount > 0 && sourceCount < 3) { categories.push('LOW_SOURCE_DEPTH'); addCategory('LOW_SOURCE_DEPTH', 'Mało niezależnych źródeł') }
    if (consensusAgreement > 0 && consensusAgreement < 60) { categories.push('SOURCE_CONFLICT'); addCategory('SOURCE_CONFLICT', 'Źródła były rozbieżne') }
    if (candidate.probability >= 67) { categories.push('OVERCONFIDENCE'); addCategory('OVERCONFIDENCE', 'Model był zbyt pewny') }
    if (Number.isFinite(clv) && clv < -3) { categories.push('NEGATIVE_CLV'); addCategory('NEGATIVE_CLV', 'Rynek przesunął się przeciwko prognozie') }
    if (['WATCH','DRIFT'].includes(String(candidate.driftStatus || '').toUpperCase())) { categories.push('MODEL_DRIFT'); addCategory('MODEL_DRIFT', 'Drift / pogorszenie modelu') }
    if (disagreement === 'HIGH') { categories.push('ENSEMBLE_DISAGREEMENT'); addCategory('ENSEMBLE_DISAGREEMENT', 'Modele składowe mocno się nie zgadzały') }
    if (!categories.length) { categories.push('NORMAL_VARIANCE'); addCategory('NORMAL_VARIANCE', 'Normalna wariancja wyniku') }

    errors.push({
      fixtureId: row.fixture_id,
      fixtureDate: row.fixture_date,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      league: row.league,
      marketKey: candidate.key,
      marketLabel: candidate.label,
      probability: round(candidate.probability, 1),
      edge: round(candidate.edge, 1),
      quality,
      sourceCount,
      consensusAgreement,
      categories
    })
  }

  const categories = [...categoryCounts.values()]
    .map(item => ({ ...item, sharePct: errors.length ? round(item.count / errors.length * 100, 1) : 0 }))
    .sort((a, b) => b.count - a.count)

  return {
    analyzed: rows.length,
    losingPredictions: errors.length,
    errorRatePct: rows.length ? round(errors.length / rows.length * 100, 1) : 0,
    categories,
    recentErrors: errors.slice(0, 12)
  }
}

function stddev(values = []) {
  const clean = values.filter(Number.isFinite)
  if (clean.length < 2) return 0
  const m = mean(clean)
  return Math.sqrt(mean(clean.map(value => (value - m) ** 2)))
}

function quantile(values = [], q = 0.5) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return 0
  const index = (clean.length - 1) * Math.max(0, Math.min(1, q))
  const lo = Math.floor(index), hi = Math.ceil(index)
  if (lo === hi) return clean[lo]
  return clean[lo] + (clean[hi] - clean[lo]) * (index - lo)
}

function rollingPortfolioWindows(settled = [], size = 50) {
  if (!settled.length) return { size, windows: 0, medianRoi: 0, worstRoi: 0, bestRoi: 0, positiveRate: 0 }
  const rows = []
  if (settled.length < size) {
    const stake = settled.reduce((sum, row) => sum + Math.max(0.01, n(row.stake_units, 1)), 0)
    const profit = settled.reduce((sum, row) => sum + n(row.profit_units), 0)
    rows.push(stake ? profit / stake * 100 : 0)
  } else {
    for (let i = 0; i <= settled.length - size; i += 1) {
      const slice = settled.slice(i, i + size)
      const stake = slice.reduce((sum, row) => sum + Math.max(0.01, n(row.stake_units, 1)), 0)
      const profit = slice.reduce((sum, row) => sum + n(row.profit_units), 0)
      rows.push(stake ? profit / stake * 100 : 0)
    }
  }
  return {
    size,
    windows: rows.length,
    medianRoi: round(quantile(rows, .5), 1),
    p25Roi: round(quantile(rows, .25), 1),
    worstRoi: round(Math.min(...rows), 1),
    bestRoi: round(Math.max(...rows), 1),
    positiveRate: round(rows.filter(value => value > 0).length / rows.length * 100, 1)
  }
}

function buildPortfolioRisk(rows = []) {
  const settled = [...rows]
    .filter(row => ['won','lost'].includes(String(row?.status || '').toLowerCase()))
    .sort((a, b) => Date.parse(a.created_at || '') - Date.parse(b.created_at || ''))
  const profits = settled.map(row => n(row.profit_units))
  const stakes = settled.map(row => Math.max(.01, n(row.stake_units, 1)))
  const totalStake = stakes.reduce((a, b) => a + b, 0)
  const totalProfit = profits.reduce((a, b) => a + b, 0)
  let equity = 0, peak = 0, maxDrawdown = 0, worstPoint = 0
  const equityCurve = []
  for (let i = 0; i < settled.length; i += 1) {
    equity += profits[i]
    peak = Math.max(peak, equity)
    const dd = peak - equity
    if (dd > maxDrawdown) { maxDrawdown = dd; worstPoint = i + 1 }
    equityCurve.push(round(equity, 2))
  }
  const volatility = stddev(profits)
  const roi = totalStake ? totalProfit / totalStake * 100 : 0
  const drawdownPctOfStake = totalStake ? maxDrawdown / totalStake * 100 : 0
  let riskScore = 35
  riskScore += Math.min(35, drawdownPctOfStake * 1.8)
  riskScore += Math.min(25, volatility * 18)
  if (roi < 0) riskScore += 10
  riskScore = Math.round(clamp(riskScore, 0, 100))
  const level = riskScore >= 75 ? 'HIGH' : riskScore >= 55 ? 'MEDIUM' : 'LOW'
  const marketCounts = new Map()
  for (const row of settled) marketCounts.set(String(row?.market_key || 'unknown'), (marketCounts.get(String(row?.market_key || 'unknown')) || 0) + 1)
  const marketShares = [...marketCounts.entries()].map(([key, count]) => ({ key, count, sharePct: settled.length ? round(count / settled.length * 100, 1) : 0 })).sort((a,b) => b.count - a.count)
  const concentrationHhi = settled.length ? round(marketShares.reduce((sum, item) => sum + (item.sharePct / 100) ** 2, 0), 3) : 0
  return {
    settled: settled.length,
    roi: round(roi, 1),
    profitUnits: round(totalProfit, 2),
    volatilityUnits: round(volatility, 3),
    maxDrawdownUnits: round(maxDrawdown, 2),
    maxDrawdownAtBet: worstPoint,
    riskScore,
    level,
    concentration: { hhi: concentrationHhi, largestMarket: marketShares[0] || null, markets: marketShares.slice(0, 8) },
    rolling: {
      w50: rollingPortfolioWindows(settled, 50),
      w100: rollingPortfolioWindows(settled, 100),
      w250: rollingPortfolioWindows(settled, 250)
    },
    equityCurve: equityCurve.slice(-200)
  }
}

function buildControlCenter({ all = {}, last30 = {}, drift = {}, leagueTrust = [], versions = [], paperPortfolio = {}, portfolioRisk = {}, errorAnalysis = {}, championChallenger = null, statisticalConfidence = null, autoGate = null } = {}) {
  const driftRows = Array.isArray(drift?.markets) ? drift.markets : []
  const driftCount = driftRows.filter(item => String(item?.status || '').toUpperCase() === 'DRIFT').length
  const watchCount = driftRows.filter(item => String(item?.status || '').toUpperCase() === 'WATCH').length
  const sortedLeagues = [...(Array.isArray(leagueTrust) ? leagueTrust : [])].sort((a,b) => n(b.overallScore) - n(a.overallScore))
  const bestLeague = sortedLeagues[0] || null
  const worstLeague = sortedLeagues.length > 1 ? sortedLeagues[sortedLeagues.length - 1] : null
  const allMarkets = Array.isArray(all?.markets) ? all.markets.filter(item => n(item.samples) > 0) : []
  const bestMarket = [...allMarkets].sort((a,b) => n(a.brier, 9) - n(b.brier, 9))[0] || null
  const worstMarket = [...allMarkets].sort((a,b) => n(b.brier) - n(a.brier))[0] || null
  const alerts = []
  if (driftCount) alerts.push(`${driftCount} rynek/rynki mają status MODEL DRIFT.`)
  if (watchCount) alerts.push(`${watchCount} rynek/rynki wymagają obserwacji.`)
  if (n(all?.matches) < 100) alerts.push('Próbka historyczna jest nadal mała (<100 meczów).')
  if (n(portfolioRisk?.riskScore) >= 75) alerts.push('Shadow Portfolio ma wysoki historyczny profil ryzyka.')
  if (n(errorAnalysis?.categories?.[0]?.sharePct) >= 35) alerts.push(`Dominujący błąd: ${errorAnalysis.categories[0].label}.`)
  if ((autoGate?.blocked || []).length) alerts.push(`AUTO-GATE blokuje: ${(autoGate.blocked || []).join(', ')}.`)
  if (championChallenger?.status === 'CHALLENGER_PROMOTED') alerts.push('Challenger został promowany na aktywny model po walidacji paired-sample.')
  if (statisticalConfidence?.portfolio?.roi95 && Number(statisticalConfidence.portfolio.roi95.low) <= 0) alerts.push('95% CI Shadow ROI obejmuje 0 — przewaga portfela nie jest jeszcze statystycznie potwierdzona.')
  let health = 'HEALTHY'
  if (driftCount >= 2 || n(all?.avgBrier) > .30 || n(portfolioRisk?.riskScore) >= 82) health = 'CRITICAL'
  else if (driftCount || watchCount >= 2 || n(all?.avgBrier) > .26 || n(portfolioRisk?.riskScore) >= 60) health = 'WATCH'
  return {
    version: 'BETAI_MODEL_CONTROL_V166',
    health,
    alerts,
    settledPredictions: n(all?.matches),
    brier: n(all?.avgBrier),
    last30Brier: n(last30?.avgBrier),
    shadowRoi: n(paperPortfolio?.roi),
    avgClv: n(paperPortfolio?.avgClv ?? all?.avgClv),
    driftCount,
    watchCount,
    bestLeague: bestLeague ? { name: bestLeague.name, score: n(bestLeague.overallScore), matches: n(bestLeague.matches) } : null,
    worstLeague: worstLeague ? { name: worstLeague.name, score: n(worstLeague.overallScore), matches: n(worstLeague.matches) } : null,
    bestMarket: bestMarket ? { key: bestMarket.key, label: bestMarket.label, brier: n(bestMarket.brier), samples: n(bestMarket.samples) } : null,
    worstMarket: worstMarket ? { key: worstMarket.key, label: worstMarket.label, brier: n(worstMarket.brier), samples: n(worstMarket.samples) } : null,
    activeModelVersion: championChallenger?.activeModel === 'challenger' ? 'BETAI_CHALLENGER_V166_DC_STRENGTH' : 'BETAI_CHAMPION_V158_CORE',
    activeModel: championChallenger?.activeModel || 'champion',
    championChallengerStatus: championChallenger?.status || 'COLLECTING',
    statConfidence: statisticalConfidence?.portfolio?.level || 'PENDING',
    blockedMarkets: autoGate?.blocked || []
  }
}



// WERSJA 167–174 — SELF LEARNING ENGINE
const SELF_MODEL_V180 = 'BETAI_CHALLENGER_V180_SELF_LEARNING_MATCH_INTEL'
const BASE_MODEL_V158 = 'BETAI_CHAMPION_V158_CORE'
const SELF_MARKETS = ['oneXTwo','over15','over25','over35','btts']
const SOURCE_DEFAULTS = {
  oneXTwo: { poisson: 1.10, dixonColes: 1.35, form: .90, api: .70, web: .45, teamStrength: 1.05 },
  over15: { poisson: 1.00, dixonColes: 1.45, recent: .65, web: .35 },
  over25: { poisson: 1.00, dixonColes: 1.45, recent: .65, web: .35 },
  over35: { poisson: 1.00, dixonColes: 1.45, recent: .65, web: .35 },
  btts: { poisson: 1.00, dixonColes: 1.45, recent: .65, web: .35 }
}

function seasonStartYearV196(dateLike = '') {
  const d = new Date(dateLike)
  if (!Number.isFinite(d.getTime())) return null
  const y = d.getUTCFullYear()
  return d.getUTCMonth() >= 6 ? y : y - 1
}

function recencyWeight(row = {}, halfLifeDays = 90) {
  const raw = row?.settled_at || row?.fixture_date || ''
  const t = Date.parse(raw)
  if (!Number.isFinite(t)) return 1
  const ageDays = Math.max(0, (Date.now() - t) / 86400000)
  const exponential = Math.pow(.5, ageDays / Math.max(15, halfLifeDays))
  const currentSeason = seasonStartYearV196(new Date().toISOString())
  const rowSeason = seasonStartYearV196(row?.fixture_date || row?.settled_at || '')
  const gap = Number.isFinite(currentSeason) && Number.isFinite(rowSeason) ? Math.max(0, currentSeason - rowSeason) : 0
  const seasonDecay = gap <= 0 ? 1 : gap === 1 ? .55 : gap === 2 ? .25 : .12
  return exponential * seasonDecay
}

function sourceProbability(source = null, market = '', actual = null) {
  if (!source || !actual) return null
  if (market === 'oneXTwo') {
    const one = source?.oneXTwo || {}
    const vals = [pct(one.home), pct(one.draw), pct(one.away)]
    if (!vals.some(v => v > 0)) return null
    const sum = vals.reduce((a,b)=>a+b,0)
    if (!(sum > 0)) return null
    const p = vals.map(v => v / sum)
    const y = [actual.home ? 1 : 0, actual.draw ? 1 : 0, actual.away ? 1 : 0]
    const brier = ((p[0]-y[0])**2 + (p[1]-y[1])**2 + (p[2]-y[2])**2) / 2
    const maxIndex = p.indexOf(Math.max(...p))
    return { brier, probability: p[maxIndex] * 100, actual: y[maxIndex], correct: Boolean(y[maxIndex]) }
  }
  const pRaw = Number(source?.goals?.[market])
  if (!Number.isFinite(pRaw)) return null
  const p = clamp(pRaw, 0, 100) / 100
  const y = actual[market] ? 1 : 0
  return { brier: (p-y)**2, probability: p*100, actual: y, correct: (p >= .5) === Boolean(y) }
}

function weightedMeanRows(rows = [], valueKey = 'value') {
  let sum = 0, wsum = 0
  for (const row of rows) {
    const w = n(row.weight, 1), v = Number(row[valueKey])
    if (!(w > 0) || !Number.isFinite(v)) continue
    sum += v * w; wsum += w
  }
  return wsum ? sum / wsum : 0
}

function sourceStats(rows = [], sourceName = '', market = '', halfLifeDays = 90) {
  const records = []
  for (const row of rows) {
    const actual = outcomes(row)
    const source = row?.forecast?.components?.[sourceName]
    const rec = sourceProbability(source, market, actual)
    if (!rec) continue
    records.push({ ...rec, weight: recencyWeight(row, halfLifeDays) })
  }
  return {
    samples: records.length,
    effectiveSamples: round(records.reduce((sum,row)=>sum+n(row.weight),0),1),
    brier: records.length ? round(weightedMeanRows(records.map(r=>({ value:r.brier, weight:r.weight }))),4) : 0,
    accuracy: records.length ? round(weightedMeanRows(records.map(r=>({ value:r.correct?100:0, weight:r.weight }))),1) : 0
  }
}

function buildMarketWeightProfile(rows = [], market = '', halfLifeDays = 90) {
  const defaults = SOURCE_DEFAULTS[market] || {}
  const stats = {}
  const viableBriers = []
  for (const source of Object.keys(defaults)) {
    stats[source] = sourceStats(rows, source, market, halfLifeDays)
    if (stats[source].samples >= 12 && stats[source].brier > 0) viableBriers.push(stats[source].brier)
  }
  viableBriers.sort((a,b)=>a-b)
  const reference = viableBriers.length ? viableBriers[Math.floor(viableBriers.length/2)] : (market === 'oneXTwo' ? .22 : .24)
  const weights = {}
  for (const [source, base] of Object.entries(defaults)) {
    const row = stats[source]
    if (!row?.samples || !(row.brier > 0)) { weights[source] = base; continue }
    const quality = clamp(Math.pow(reference / Math.max(.05, row.brier), 1.10), .60, 1.55)
    // V186: shrink learned weights toward the stable default until the sample is large.
    // This prevents a lucky 15–40 match run from creating an extreme source weight.
    const effective = Math.max(0, n(row.effectiveSamples, row.samples))
    const learn = clamp(effective / (effective + 95), 0, .74)
    const proposed = base * (1 + (quality - 1) * learn)
    const capLow = base * .68, capHigh = base * 1.42
    weights[source] = round(clamp(proposed, capLow, capHigh), 3)
  }
  return { key: market, label: marketLabels[market] || market, samples: rows.length, weights, sourceStats: stats, referenceBrier: round(reference,4) }
}

function globalWeightsFromMarkets(marketProfiles = []) {
  const collected = new Map()
  for (const market of marketProfiles) {
    for (const [source, weight] of Object.entries(market?.weights || {})) {
      if (!collected.has(source)) collected.set(source, [])
      collected.get(source).push(Number(weight))
    }
  }
  return Object.fromEntries([...collected.entries()].map(([source, values]) => [source, round(mean(values),3)]))
}

function buildFeatureLab(marketProfiles = []) {
  const map = new Map()
  for (const market of marketProfiles) {
    for (const [source, row] of Object.entries(market?.sourceStats || {})) {
      if (!row?.samples) continue
      if (!map.has(source)) map.set(source, { source, samples:0, effectiveSamples:0, weightedBrier:0, accuracyWeighted:0, markets:0 })
      const item = map.get(source)
      item.samples += n(row.samples)
      item.effectiveSamples += n(row.effectiveSamples)
      item.weightedBrier += n(row.brier) * Math.max(1,n(row.effectiveSamples))
      item.accuracyWeighted += n(row.accuracy) * Math.max(1,n(row.effectiveSamples))
      item.markets += 1
    }
  }
  const rows = [...map.values()].map(item => ({
    source: item.source,
    samples: item.samples,
    effectiveSamples: round(item.effectiveSamples,1),
    brier: item.effectiveSamples ? round(item.weightedBrier/item.effectiveSamples,4) : 0,
    accuracy: item.effectiveSamples ? round(item.accuracyWeighted/item.effectiveSamples,1) : 0,
    markets: item.markets
  })).sort((a,b)=>a.brier-b.brier || b.samples-a.samples)
  return rows.map((item,index)=>({ ...item, rank:index+1, status:item.samples>=100?'PROVEN':item.samples>=30?'LEARNING':'EARLY' }))
}

function calibrationForMarket(rows = [], market = '', halfLifeDays = 90) {
  const recs = []
  for (const row of rows) {
    const actual = outcomes(row)
    const source = row?.forecast || {}
    if (!actual) continue
    if (market === 'oneXTwo') {
      const one = source?.oneXTwo || {}
      const vals = [pct(one.home),pct(one.draw),pct(one.away)]
      const sum = vals.reduce((a,b)=>a+b,0)
      if (!(sum>0)) continue
      const p = vals.map(v=>v/sum*100)
      const y = [actual.home?1:0,actual.draw?1:0,actual.away?1:0]
      const idx = p.indexOf(Math.max(...p))
      recs.push({ predicted:p[idx], actual:y[idx], weight:recencyWeight(row,halfLifeDays) })
    } else {
      const p = Number(source?.goals?.[market])
      if (!Number.isFinite(p)) continue
      recs.push({ predicted:clamp(p,0,100), actual:actual[market]?1:0, weight:recencyWeight(row,halfLifeDays) })
    }
  }
  const samples = recs.length
  if (!samples) return { key:market, samples:0, biasPp:0, power:1, avgPredicted:0, actualRate:0 }
  const avgPredicted = weightedMeanRows(recs.map(r=>({value:r.predicted,weight:r.weight})))
  const actualRate = weightedMeanRows(recs.map(r=>({value:r.actual*100,weight:r.weight})))
  const gap = actualRate - avgPredicted
  const shrink = clamp(samples/(samples+70),0,.85)
  if (market === 'oneXTwo') {
    const overconfidence = avgPredicted - actualRate
    const power = clamp(1 - (overconfidence/35)*shrink, .72, 1.18)
    return { key:market, samples, avgPredicted:round(avgPredicted,1), actualRate:round(actualRate,1), gapPp:round(gap,1), biasPp:0, power:round(power,3) }
  }
  return { key:market, samples, avgPredicted:round(avgPredicted,1), actualRate:round(actualRate,1), gapPp:round(gap,1), biasPp:round(clamp(gap*shrink,-8,8),1), power:1 }
}

function buildAdaptiveCalibration(rows = [], halfLifeDays = 90) {
  const marketProfiles = SELF_MARKETS.map(key=>calibrationForMarket(rows,key,halfLifeDays))
  const leagueGroups = new Map()
  for (const row of rows) {
    const league = String(row?.league || '').trim()
    if (!league) continue
    if (!leagueGroups.has(league)) leagueGroups.set(league,[])
    leagueGroups.get(league).push(row)
  }
  const leagueProfiles = [...leagueGroups.entries()].filter(([,group])=>group.length>=35).map(([league,group])=>({
    league, samples:group.length, markets:SELF_MARKETS.map(key=>calibrationForMarket(group,key,halfLifeDays))
  })).sort((a,b)=>b.samples-a.samples).slice(0,30)
  return { version:'BETAI_ADAPTIVE_CALIBRATION_V172', marketProfiles, leagueProfiles }
}

function buildSelfLearningV174(experimentRows = []) {
  const rows = experimentRows.filter(row => String(row?.model_role || '').toLowerCase()==='challenger' && String(row?.model_version || '')===SELF_MODEL_V180 && row?.forecast?.components)
  const halfLifeDays = 90
  const marketProfiles = SELF_MARKETS.map(key=>buildMarketWeightProfile(rows,key,halfLifeDays))
  const leagueGroups = new Map()
  for (const row of rows) {
    const league = String(row?.league || '').trim()
    if (!league) continue
    if (!leagueGroups.has(league)) leagueGroups.set(league,[])
    leagueGroups.get(league).push(row)
  }
  const leagueProfiles = [...leagueGroups.entries()].filter(([,group])=>group.length>=30).map(([league,group])=>({
    league, samples:group.length, markets:SELF_MARKETS.map(key=>buildMarketWeightProfile(group,key,halfLifeDays))
  })).sort((a,b)=>b.samples-a.samples).slice(0,30)
  return {
    version:'BETAI_SELF_LEARNING_ENGINE_V174',
    samples:rows.length,
    recency:{ halfLifeDays, method:'exponential-decay', newestWeight:1 },
    globalWeights:globalWeightsFromMarkets(marketProfiles),
    marketProfiles,
    leagueProfiles,
    featureLab:buildFeatureLab(marketProfiles),
    adaptiveCalibration:buildAdaptiveCalibration(rows,halfLifeDays)
  }
}

function pairRowsV180(experimentRows = []) {
  const grouped = new Map()
  for (const row of experimentRows) {
    const fixtureId = String(row?.fixture_id || '')
    if (!fixtureId) continue
    if (!grouped.has(fixtureId)) grouped.set(fixtureId,{ champions:[], challengers:[] })
    const g=grouped.get(fixtureId)
    if (String(row?.model_role || '').toLowerCase()==='champion') g.champions.push(row)
    if (String(row?.model_role || '').toLowerCase()==='challenger' && String(row?.model_version || '')===SELF_MODEL_V180) g.challengers.push(row)
  }
  const pairs=[]
  for (const [fixtureId,g] of grouped.entries()) {
    if (!g.champions.length || !g.challengers.length) continue
    g.champions.sort((a,b)=>Date.parse(b.settled_at||'')-Date.parse(a.settled_at||''))
    g.challengers.sort((a,b)=>Date.parse(b.settled_at||'')-Date.parse(a.settled_at||''))
    pairs.push({ fixtureId, champion:g.champions[0], challenger:g.challengers[0], settledAt:g.challengers[0]?.settled_at || g.champions[0]?.settled_at || '' })
  }
  return pairs.sort((a,b)=>Date.parse(b.settledAt||'')-Date.parse(a.settledAt||''))
}

async function fetchModelRegistryV173(supabase) {
  const { data, error } = await supabase.from('match_model_registry').select('*').eq('registry_key','football-main').maybeSingle()
  if (error) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message||''))) return null
    throw error
  }
  return data || null
}

function buildGovernanceV173(experimentRows = [], registry = null) {
  const pairs = pairRowsV180(experimentRows)
  const championRows = pairs.map(p=>({ ...p.champion, forecast:p.champion.forecast }))
  const challengerRows = pairs.map(p=>({ ...p.challenger, forecast:p.challenger.forecast }))
  const champion = aggregateVariantRows(championRows)
  const challenger = aggregateVariantRows(challengerRows)
  const pairedSamples = pairs.length
  const brierDelta = pairedSamples ? round(n(champion.avgBrier)-n(challenger.avgBrier),4) : 0
  const marketRegressions=(challenger.markets||[]).filter(item=>{
    const base=(champion.markets||[]).find(x=>x.key===item.key)
    return n(item.samples)>=50 && n(base?.samples)>=50 && n(item.brier)>n(base?.brier)+.015
  }).map(x=>x.key)
  const recentPairs=pairs.slice(0,50)
  const recentChampion=aggregateVariantRows(recentPairs.map(p=>({ ...p.champion, forecast:p.champion.forecast })))
  const recentChallenger=aggregateVariantRows(recentPairs.map(p=>({ ...p.challenger, forecast:p.challenger.forecast })))
  const recentDelta=recentPairs.length ? round(n(recentChampion.avgBrier)-n(recentChallenger.avgBrier),4) : 0

  let activeVersion=String(registry?.active_version || BASE_MODEL_V158)
  let previousVersion=String(registry?.previous_version || '') || null
  let status='COLLECTING'
  let reason=`V180 ma ${pairedSamples}/120 rozliczonych par. Champion pozostaje aktywny.`
  let action='NONE'
  const requiredSamples=120
  const lastActionSamples=n(registry?.metadata?.pairedSamples,0)
  const rollbackCooldown=String(registry?.status||'').toUpperCase()==='AUTO_ROLLBACK' && pairedSamples-lastActionSamples<60
  if (activeVersion===SELF_MODEL_V180) {
    status='V180_ACTIVE'
    reason=`V180 jest aktywny. Monitorujemy rolling 50 i automatyczny rollback.`
    if (recentPairs.length>=40 && (recentDelta<=-.025 || marketRegressions.length>=2)) {
      action='ROLLBACK'
      previousVersion=SELF_MODEL_V180
      activeVersion=BASE_MODEL_V158
      status='AUTO_ROLLBACK'
      reason=recentDelta<=-.025 ? `Rollback: w ostatnich ${recentPairs.length} parach V180 pogorszył Brier o ${Math.abs(recentDelta).toFixed(4)}.` : `Rollback: regresja na ${marketRegressions.length} rynkach.`
    }
  } else if (rollbackCooldown) {
    status='ROLLBACK_COOLDOWN'
    reason=`Po rollbacku wymagamy 60 nowych sparowanych meczów przed kolejną promocją (${Math.max(0,pairedSamples-lastActionSamples)}/60).`
  } else if (pairedSamples>=requiredSamples) {
    if (brierDelta>=.004 && recentDelta>=.001 && !marketRegressions.length) {
      action='PROMOTE'
      previousVersion=activeVersion || BASE_MODEL_V158
      activeVersion=SELF_MODEL_V180
      status='AUTO_PROMOTED'
      reason=`V180 poprawił Brier o ${brierDelta.toFixed(4)} na ${pairedSamples} sparowanych meczach, rolling-50 nie przeczy przewadze i nie ma istotnej regresji rynków.`
    } else if (brierDelta<=-.004) {
      status='CHAMPION_WIN'
      reason=`Champion jest lepszy o ${Math.abs(brierDelta).toFixed(4)} Brier.`
    } else {
      status='NO_CLEAR_WINNER'
      reason='Brak wymaganej przewagi 0.004 Brier bez regresji rynkowej.'
    }
  }
  return {
    version:'BETAI_MODEL_GOVERNANCE_V173', activeVersion, previousVersion, status, reason, action,
    pairedSamples, requiredSamples, brierDelta, recent50BrierDelta:recentDelta, marketRegressions,
    rollbackArmed:activeVersion===SELF_MODEL_V180, rollbackCooldown, newSamplesSinceAction:Math.max(0,pairedSamples-lastActionSamples), champion, challenger
  }
}

async function persistGovernanceV173(supabase, governance = {}, registry = null) {
  if (!governance || !['PROMOTE','ROLLBACK'].includes(governance.action)) return governance
  const now=new Date().toISOString()
  const row={
    registry_key:'football-main',
    active_version:governance.activeVersion,
    previous_version:governance.previousVersion,
    status:governance.status,
    promoted_at:governance.action==='PROMOTE'?now:(registry?.promoted_at||null),
    rollback_at:governance.action==='ROLLBACK'?now:(registry?.rollback_at||null),
    updated_at:now,
    metadata:{ pairedSamples:governance.pairedSamples,brierDelta:governance.brierDelta,recent50BrierDelta:governance.recent50BrierDelta,marketRegressions:governance.marketRegressions,reason:governance.reason }
  }
  const { error }=await supabase.from('match_model_registry').upsert(row,{onConflict:'registry_key'})
  if (error && !/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message||''))) throw error
  try {
    await supabase.from('match_model_governance_events').insert({ event_type:governance.action.toLowerCase(), from_version:governance.action==='PROMOTE'?governance.previousVersion:SELF_MODEL_V180, to_version:governance.activeVersion, reason:governance.reason, metrics:row.metadata, created_at:now })
  } catch (_) {}
  return { ...governance, persisted:true, changedAt:now }
}


function simpleProfileHash(value = '') {
  const text=String(value||'')
  let hash=2166136261
  for (let i=0;i<text.length;i+=1) { hash^=text.charCodeAt(i); hash=Math.imul(hash,16777619) }
  return (hash>>>0).toString(16).padStart(8,'0')
}

async function persistSelfLearningProfilesV174(supabase, selfLearning = {}) {
  const rows=[]
  const push=(profileKey,profileType,league,marketKey,weights,calibration,sampleSize,metrics={})=>{
    const payload={weights:weights||{},calibration:calibration||{},sampleSize:n(sampleSize),halfLifeDays:n(selfLearning?.recency?.halfLifeDays,90),metrics:metrics||{}}
    const hash=simpleProfileHash(JSON.stringify(payload))
    rows.push({ profile_key:profileKey, model_version:SELF_MODEL_V180, profile_type:profileType, league:league||null, market_key:marketKey||null, sample_size:n(sampleSize), half_life_days:n(selfLearning?.recency?.halfLifeDays,90), weights:weights||{}, calibration:calibration||{}, metrics:metrics||{}, profile_hash:hash })
  }
  const globalCal=selfLearning?.adaptiveCalibration?.marketProfiles||[]
  push('global','global',null,null,selfLearning?.globalWeights||{}, {markets:globalCal}, selfLearning?.samples||0, {featureLab:(selfLearning?.featureLab||[]).slice(0,10)})
  for (const market of selfLearning?.marketProfiles||[]) {
    const cal=globalCal.find(item=>item.key===market.key)||{}
    push(`market:${market.key}`,'market',null,market.key,market.weights||{},cal,market.samples||0,{sourceStats:market.sourceStats||{}})
  }
  for (const leagueRow of (selfLearning?.leagueProfiles||[]).slice(0,10)) {
    const leagueCal=(selfLearning?.adaptiveCalibration?.leagueProfiles||[]).find(item=>item.league===leagueRow.league)
    for (const market of leagueRow.markets||[]) {
      const cal=leagueCal?.markets?.find(item=>item.key===market.key)||{}
      push(`league_market:${leagueRow.league}:${market.key}`,'league_market',leagueRow.league,market.key,market.weights||{},cal,leagueRow.samples||0,{sourceStats:market.sourceStats||{}})
    }
  }
  if (!rows.length) return { available:false, changed:0, updatedAt:null }
  const keys=rows.map(r=>r.profile_key)
  const { data:existing,error:readError }=await supabase.from('match_model_learning_profiles').select('profile_key,profile_hash,updated_at').in('profile_key',keys)
  if (readError) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(String(readError.message||''))) return { available:false, changed:0, updatedAt:null }
    throw readError
  }
  const map=new Map((existing||[]).map(r=>[r.profile_key,r]))
  const changed=rows.filter(r=>String(map.get(r.profile_key)?.profile_hash||'')!==String(r.profile_hash||''))
  const now=new Date().toISOString()
  if (changed.length) {
    const payload=changed.map(r=>({ ...r, updated_at:now }))
    const { error }=await supabase.from('match_model_learning_profiles').upsert(payload,{onConflict:'profile_key'})
    if (error && !/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message||''))) throw error
  }
  const existingTimes=(existing||[]).map(r=>Date.parse(r.updated_at||'')).filter(Number.isFinite)
  const updatedAt=changed.length?now:(existingTimes.length?new Date(Math.max(...existingTimes)).toISOString():null)
  return { available:true, profiles:rows.length, changed:changed.length, updatedAt }
}

function buildBrainDashboardV174(selfLearning = {}, governance = {}, all = {}, leagueTrust = []) {
  const features=selfLearning?.featureLab||[]
  const bestLeague=[...(leagueTrust||[])].sort((a,b)=>n(b.overallScore)-n(a.overallScore))[0]||null
  const worstLeague=[...(leagueTrust||[])].sort((a,b)=>n(a.overallScore)-n(b.overallScore))[0]||null
  const marketProfiles=selfLearning?.marketProfiles||[]
  return {
    version:'BETAI_MODEL_BRAIN_DASHBOARD_V174',
    activeVersion:governance?.activeVersion||BASE_MODEL_V158,
    governanceStatus:governance?.status||'COLLECTING',
    selfLearningSamples:n(selfLearning?.samples),
    halfLifeDays:n(selfLearning?.recency?.halfLifeDays,90),
    topFeatures:features.slice(0,5),
    bestLeague:bestLeague?{name:bestLeague.name,score:n(bestLeague.overallScore),matches:n(bestLeague.matches)}:null,
    worstLeague:worstLeague?{name:worstLeague.name,score:n(worstLeague.overallScore),matches:n(worstLeague.matches)}:null,
    marketWeights:marketProfiles.map(row=>({ key:row.key,label:row.label,weights:row.weights })),
    brier:n(all?.avgBrier),
    pairedSamples:n(governance?.pairedSamples),
    rollbackArmed:Boolean(governance?.rollbackArmed),
    profileUpdatedAt:selfLearning?.profileStorage?.updatedAt||null
  }
}



// WERSJA 181–200 — RELIABILITY, DATA INTEGRITY & DATA SCIENCE LAB
const DS_MARKETS_V200 = ['oneXTwo','over15','over25','over35','btts']

function safeProbV200(value) { return clamp(n(value, .5), .005, .995) }
function logLossBinaryV191(probability, actual) {
  const p = safeProbV200(Number(probability) > 1 ? Number(probability) / 100 : Number(probability))
  const y = actual ? 1 : 0
  return -(y * Math.log(p) + (1 - y) * Math.log(1 - p))
}
function rowLogLossV191(row = {}) {
  const actual = outcomes(row)
  const forecast = row?.forecast || {}
  if (!actual) return []
  const out = []
  const one = forecast?.oneXTwo || {}
  const vals = [pct(one.home), pct(one.draw), pct(one.away)].map(v => Math.max(.01, v / 100))
  const total = vals.reduce((a,b)=>a+b,0)
  if (total > 0) {
    const ps = vals.map(v=>v/total)
    const idx = actual.home ? 0 : actual.draw ? 1 : 2
    out.push({ market:'oneXTwo', logLoss:-Math.log(Math.max(.005, ps[idx])), brier:predictionRecords(row,'calibrated').find(r=>r.market==='oneXTwo')?.brier ?? 0 })
  }
  const goals = forecast?.goals || {}
  for (const key of ['over15','over25','over35','btts']) {
    if (!Number.isFinite(Number(goals[key]))) continue
    const rec = predictionRecords(row,'calibrated').find(r=>r.market===key)
    out.push({ market:key, logLoss:logLossBinaryV191(Number(goals[key])/100, Boolean(actual[key])), brier:n(rec?.brier) })
  }
  return out
}

function binaryObservationsV200(rows = [], market = '') {
  return [...rows].sort((a,b)=>rowTime(a)-rowTime(b)).map(row => {
    const actual = outcomes(row); if (!actual) return null
    const p = Number(row?.forecast?.goals?.[market])
    if (!Number.isFinite(p)) return null
    return { p:clamp(p/100,.005,.995), y:actual[market]?1:0, time:rowTime(row), league:String(row?.league||'') }
  }).filter(Boolean)
}

function oneXTwoObservationsV200(rows = []) {
  return [...rows].sort((a,b)=>rowTime(a)-rowTime(b)).map(row=>{
    const actual=outcomes(row); const one=row?.forecast?.oneXTwo||{}; if(!actual) return null
    const vals=[pct(one.home),pct(one.draw),pct(one.away)].map(v=>Math.max(.01,v/100)); const sum=vals.reduce((a,b)=>a+b,0); if(!(sum>0)) return null
    return { p:vals.map(v=>v/sum), y:actual.home?0:actual.draw?1:2, time:rowTime(row), league:String(row?.league||'') }
  }).filter(Boolean)
}

function fitPlattV193(obs = []) {
  if (obs.length < 25) return { a:1,b:0 }
  let a=1,b=0
  const lr=.08, l2=.015
  for(let iter=0;iter<260;iter+=1){
    let ga=0,gb=0
    for(const o of obs){
      const x=Math.log(safeProbV200(o.p)/(1-safeProbV200(o.p)))
      const q=1/(1+Math.exp(-(a*x+b)))
      ga+=(q-o.y)*x; gb+=(q-o.y)
    }
    ga=ga/obs.length+l2*(a-1); gb/=obs.length
    a-=lr*ga; b-=lr*gb
    a=clamp(a,.25,2.5); b=clamp(b,-2,2)
  }
  return { a:round(a,4), b:round(b,4) }
}
function predictPlattV193(p, params={}) {
  const pp=safeProbV200(p), x=Math.log(pp/(1-pp)), a=n(params.a,1), b=n(params.b,0)
  return safeProbV200(1/(1+Math.exp(-(a*x+b))))
}

function fitIsotonicV192(obs = []) {
  if (obs.length < 25) return { points:[] }
  const sorted=[...obs].sort((a,b)=>a.p-b.p)
  const targetBins=Math.min(12,Math.max(5,Math.floor(Math.sqrt(sorted.length))))
  const size=Math.max(1,Math.ceil(sorted.length/targetBins))
  let blocks=[]
  for(let i=0;i<sorted.length;i+=size){
    const part=sorted.slice(i,i+size)
    blocks.push({ x:mean(part.map(o=>o.p)), y:mean(part.map(o=>o.y)), w:part.length })
  }
  let i=0
  while(i<blocks.length-1){
    if(blocks[i].y<=blocks[i+1].y){ i+=1; continue }
    const a=blocks[i],b=blocks[i+1],w=a.w+b.w
    blocks.splice(i,2,{x:(a.x*a.w+b.x*b.w)/w,y:(a.y*a.w+b.y*b.w)/w,w})
    i=Math.max(0,i-1)
  }
  return { points:blocks.map(b=>({x:round(b.x*100,1),y:round(clamp(b.y*100,1,99),1),samples:b.w})) }
}
function predictIsotonicV192(p, params={}) {
  const x=safeProbV200(p)*100, pts=(params.points||[]).slice().sort((a,b)=>n(a.x)-n(b.x))
  if(!pts.length) return safeProbV200(p)
  if(x<=n(pts[0].x)) return safeProbV200(n(pts[0].y)/100)
  if(x>=n(pts[pts.length-1].x)) return safeProbV200(n(pts[pts.length-1].y)/100)
  for(let i=1;i<pts.length;i+=1){
    if(x>n(pts[i].x)) continue
    const lo=pts[i-1],hi=pts[i],span=Math.max(.01,n(hi.x)-n(lo.x)),t=(x-n(lo.x))/span
    return safeProbV200((n(lo.y)+(n(hi.y)-n(lo.y))*t)/100)
  }
  return safeProbV200(p)
}

function evaluateBinaryCalibrationV198(obs = []) {
  const minTrain=60, block=20
  if(obs.length < 80) return { samples:obs.length, validationSamples:0, selectedMethod:'RAW', status:'COLLECTING', improvement:0, parameters:{} }
  const losses={RAW:[],PLATT:[],ISOTONIC:[]}
  for(let start=minTrain;start<obs.length;start+=block){
    const train=obs.slice(0,start), test=obs.slice(start,Math.min(obs.length,start+block)); if(!test.length) break
    const pp=fitPlattV193(train), iso=fitIsotonicV192(train)
    for(const o of test){
      losses.RAW.push(logLossBinaryV191(o.p,o.y))
      losses.PLATT.push(logLossBinaryV191(predictPlattV193(o.p,pp),o.y))
      losses.ISOTONIC.push(logLossBinaryV191(predictIsotonicV192(o.p,iso),o.y))
    }
  }
  const score=Object.fromEntries(Object.entries(losses).map(([k,v])=>[k,v.length?mean(v):9]))
  const ordered=Object.entries(score).sort((a,b)=>a[1]-b[1])
  let selected=ordered[0][0]
  const improvement=score.RAW-score[selected]
  if(selected!=='RAW' && improvement<.003) selected='RAW'
  const fullParams=selected==='PLATT'?fitPlattV193(obs):selected==='ISOTONIC'?fitIsotonicV192(obs):{}
  return { samples:obs.length, validationSamples:losses.RAW.length, selectedMethod:selected, status:losses.RAW.length>=40?'VALIDATED':'LEARNING', rawLogLoss:round(score.RAW,4), plattLogLoss:round(score.PLATT,4), isotonicLogLoss:round(score.ISOTONIC,4), selectedLogLoss:round(score[selected],4), improvement:round(score.RAW-score[selected],4), parameters:fullParams }
}

function temperatureScaleV200(probs = [], temp = 1) {
  const vals=probs.map(p=>Math.pow(Math.max(.0001,p),1/clamp(temp,.6,1.7)))
  const s=vals.reduce((a,b)=>a+b,0); return vals.map(v=>v/s)
}
function bestTemperatureV200(obs = []) {
  let best={temperature:1,loss:Infinity}
  for(let t=.70;t<=1.50;t+=.05){
    const loss=mean(obs.map(o=>-Math.log(Math.max(.005,temperatureScaleV200(o.p,t)[o.y]))))
    if(loss<best.loss) best={temperature:t,loss}
  }
  return { temperature:round(best.temperature,2), loss:round(best.loss,4) }
}
function evaluateOneXTwoTemperatureV198(obs = []) {
  if(obs.length<100) return { samples:obs.length,validationSamples:0,selectedMethod:'RAW',status:'COLLECTING',improvement:0,parameters:{temperature:1} }
  const minTrain=80,block=25,raw=[],scaled=[]
  for(let start=minTrain;start<obs.length;start+=block){
    const train=obs.slice(0,start),test=obs.slice(start,Math.min(obs.length,start+block)),fit=bestTemperatureV200(train)
    for(const o of test){ raw.push(-Math.log(Math.max(.005,o.p[o.y]))); scaled.push(-Math.log(Math.max(.005,temperatureScaleV200(o.p,fit.temperature)[o.y]))) }
  }
  const rawLoss=raw.length?mean(raw):9, scaledLoss=scaled.length?mean(scaled):9, imp=rawLoss-scaledLoss
  const selected=imp>=.003?'TEMPERATURE':'RAW'
  const full=bestTemperatureV200(obs)
  return { samples:obs.length,validationSamples:raw.length,selectedMethod:selected,status:raw.length>=40?'VALIDATED':'LEARNING',rawLogLoss:round(rawLoss,4),temperatureLogLoss:round(scaledLoss,4),selectedLogLoss:round(selected==='TEMPERATURE'?scaledLoss:rawLoss,4),improvement:round(selected==='TEMPERATURE'?imp:0,4),parameters:{temperature:selected==='TEMPERATURE'?full.temperature:1} }
}

function leagueBayesianPriorsV194(rows = []) {
  const globals={}
  for(const key of ['over15','over25','over35','btts']){
    const obs=binaryObservationsV200(rows,key); globals[key]=obs.length?mean(obs.map(o=>o.y)):.5
  }
  const groups=new Map()
  for(const row of rows){ const league=String(row?.league||'').trim(); if(!league)continue; if(!groups.has(league))groups.set(league,[]); groups.get(league).push(row) }
  return [...groups.entries()].filter(([,g])=>g.length>=12).map(([league,g])=>{
    const markets={}
    for(const key of ['over15','over25','over35','btts']){
      const obs=binaryObservationsV200(g,key), prior=globals[key], strength=30, hits=obs.reduce((a,o)=>a+o.y,0)
      markets[key]={samples:obs.length,prior:round(prior*100,1),posterior:round((hits+prior*strength)/(obs.length+strength)*100,1),shrinkage:round(strength/(obs.length+strength),3)}
    }
    return {league,samples:g.length,markets}
  }).sort((a,b)=>b.samples-a.samples).slice(0,30)
}

function addHierarchicalShrinkV195(profile = {}, leagueSamples = 0) {
  const shrink=clamp(leagueSamples/(leagueSamples+70),.20,.92)
  return { ...profile, hierarchicalShrink:round(shrink,3) }
}

function seasonDecayV196(rows = []) {
  const current=seasonStartYearV196(new Date().toISOString()), map=new Map()
  for(const row of rows){ const season=seasonStartYearV196(row.fixture_date||row.settled_at||''); if(!Number.isFinite(season))continue; map.set(season,(map.get(season)||0)+1) }
  return { currentSeason:current?`${current}/${String(current+1).slice(-2)}`:'UNKNOWN', policy:[{gap:0,weight:1},{gap:1,weight:.55},{gap:2,weight:.25},{gap:'3+',weight:.12}], samples:[...map.entries()].sort((a,b)=>b[0]-a[0]).map(([season,count])=>({season:`${season}/${String(season+1).slice(-2)}`,count,weight:season===current?1:season===current-1?.55:season===current-2?.25:.12})) }
}

function stackingWeightsV197(experimentRows = []) {
  const challengers=experimentRows.filter(r=>String(r?.model_role||'').toLowerCase()==='challenger'&&r?.forecast?.components)
  const sourceNames=['poisson','dixonColes','form','api','web','teamStrength','recent']
  const profiles={}
  for(const market of DS_MARKETS_V200){
    const scores=[]
    for(const source of sourceNames){
      const stat=sourceStats(challengers,source,market,90)
      if(stat.samples<20||!(stat.brier>0)) continue
      const confidence=clamp(stat.effectiveSamples/(stat.effectiveSamples+80),.15,.85)
      const inverse=1/Math.max(.08,stat.brier)
      scores.push({source,samples:stat.samples,brier:stat.brier,raw:inverse,confidence})
    }
    const total=scores.reduce((a,b)=>a+b.raw,0)||1
    profiles[market]=scores.map(r=>({source:r.source,samples:r.samples,brier:r.brier,weight:round((.5*(1/scores.length||0)+.5*(r.raw/total))*r.confidence + (1-r.confidence)*(1/Math.max(1,scores.length)),3)}))
  }
  return profiles
}

function bootstrapConfidenceV199(rows = [], reps = 180) {
  const records=rows.flatMap(row=>predictionRecords(row,'calibrated')).filter(r=>Number.isFinite(n(r.brier)))
  if(records.length<30) return {samples:records.length,reps:0,level:'PENDING',brier95:{low:0,high:0}}
  let seed=(records.length*2654435761)>>>0
  const rand=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296 }
  const vals=[]
  for(let r=0;r<reps;r+=1){ let sum=0; for(let i=0;i<records.length;i+=1) sum+=n(records[Math.floor(rand()*records.length)]?.brier); vals.push(sum/records.length) }
  vals.sort((a,b)=>a-b)
  const low=quantile(vals,.025),high=quantile(vals,.975),width=high-low
  return {samples:records.length,reps,level:width<=.03?'HIGH':width<=.06?'MEDIUM':'LOW',brier95:{low:round(low,4),high:round(high,4),width:round(width,4)}}
}

function buildDataScienceV200(rows = [], experimentRows = [], leagueTrust = []) {
  const logs=rows.flatMap(rowLogLossV191)
  const logLoss=logs.length?mean(logs.map(r=>r.logLoss)):0
  const marketProfiles=[]
  const oneProfile=evaluateOneXTwoTemperatureV198(oneXTwoObservationsV200(rows))
  marketProfiles.push({key:'oneXTwo',label:'1X2',...oneProfile,hierarchicalShrink:1})
  for(const key of ['over15','over25','over35','btts']) marketProfiles.push({key,label:marketLabels[key],...evaluateBinaryCalibrationV198(binaryObservationsV200(rows,key)),hierarchicalShrink:1})
  const leagueGroups=new Map()
  for(const row of rows){const league=String(row?.league||'').trim();if(!league)continue;if(!leagueGroups.has(league))leagueGroups.set(league,[]);leagueGroups.get(league).push(row)}
  const leagueProfiles=[...leagueGroups.entries()].filter(([,g])=>g.length>=50).map(([league,g])=>({
    league,samples:g.length,markets:[
      addHierarchicalShrinkV195({key:'oneXTwo',label:'1X2',...evaluateOneXTwoTemperatureV198(oneXTwoObservationsV200(g))},g.length),
      ...['over15','over25','over35','btts'].map(key=>addHierarchicalShrinkV195({key,label:marketLabels[key],...evaluateBinaryCalibrationV198(binaryObservationsV200(g,key))},g.length))
    ]
  })).sort((a,b)=>b.samples-a.samples).slice(0,20)
  const validated=marketProfiles.filter(p=>p.status==='VALIDATED')
  const improvements=validated.map(p=>n(p.improvement))
  const avgImp=improvements.length?mean(improvements):0
  const overfitScore=Math.round(clamp(100-(rows.length<100?35:0)-validated.filter(p=>n(p.improvement)<0).length*15-(avgImp<.001?15:0),0,100))
  const overfitLevel=overfitScore>=78?'LOW':overfitScore>=58?'MEDIUM':'HIGH'
  const winner=validated.filter(p=>p.selectedMethod!=='RAW').length>=2?'CALIBRATED_STACK':'BASE'
  const bootstrap=bootstrapConfidenceV199(rows)
  const stacking=stackingWeightsV197(experimentRows)
  return {
    version:'BETAI_DATA_SCIENCE_LAB_V200',
    modules:['V191_LOG_LOSS','V192_ISOTONIC','V193_PLATT','V194_BAYESIAN_PRIORS','V195_HIERARCHICAL','V196_SEASON_DECAY','V197_STACKING','V198_OOS_WALK_FORWARD','V199_BOOTSTRAP','V200_AUTO_SELECTION'],
    decisionQuality:{
      samples:rows.length,graded:logs.length,logLoss:round(logLoss,4),brier:round(mean(logs.map(r=>r.brier)),4),
      clvSamples:n(rows.filter(r=>r?.settlement?.clv?.qualifiedClosing).length),
      positiveClvRate: (()=>{const c=rows.map(r=>r?.settlement?.clv).filter(x=>x?.qualifiedClosing&&Number.isFinite(Number(x?.clvPct)));return c.length?round(c.filter(x=>Number(x.clvPct)>0).length/c.length*100,1):0})(),
      abstentions:rows.filter(r=>Boolean(r?.forecast?.reliabilityV190?.abstention?.abstain||r?.forecast?.professionalLab?.decisionCard?.abstention)).length,
      abstentionRate:rows.length?round(rows.filter(r=>Boolean(r?.forecast?.reliabilityV190?.abstention?.abstain||r?.forecast?.professionalLab?.decisionCard?.abstention)).length/rows.length*100,1):0
    },
    calibration:{marketProfiles,leagueProfiles},
    bayesianPriors:leagueBayesianPriorsV194(rows),
    seasonDecay:seasonDecayV196(rows),
    stacking,
    bootstrap,
    overfittingGuard:{score:overfitScore,level:overfitLevel,validatedMarkets:validated.length,avgOosLogLossLift:round(avgImp,4),weightShrinkage:'ACTIVE'},
    autoSelection:{status:rows.length>=120&&validated.length>=3?'VALIDATED':'COLLECTING',winner,validatedMarkets:validated.length,reason:rows.length<120?`Potrzeba min. 120 meczów (${rows.length}/120).`:winner==='CALIBRATED_STACK'?'Co najmniej 2 kalibratory poprawiają log loss out-of-sample.':'Brak stabilnej przewagi kalibracji nad bazą.'}
  }
}

async function fetchIntegrityControlV190(supabase) {
  const safeCount=async(table,filters=[])=>{let q=supabase.from(table).select('*',{count:'exact',head:true});for(const [op,col,val] of filters){q=q[op](col,val)};const {count,error}=await q;if(error)throw error;return n(count)}
  try{
    const freezes=await safeCount('match_prediction_freeze_ledger')
    const leaks=await safeCount('match_integrity_events',[['eq','event_type','data_leakage_blocked']])
    const duplicates=await safeCount('match_integrity_events',[['eq','event_type','duplicate_fixture']])
    const mismatches=await safeCount('match_integrity_events',[['eq','event_type','settlement_fixture_mismatch']])
    let health='HEALTHY'; if(leaks+mismatches>0) health='WATCH'; if(mismatches>=3) health='CRITICAL'
    return {version:'BETAI_RELIABILITY_CONTROL_V190',health,freezeSnapshots:freezes,leakageBlocks:leaks,duplicateFixtures:duplicates,settlementMismatches:mismatches,settlementIntegrity:mismatches===0?'100% CLEAR':'REVIEW'}
  }catch(error){
    if(/relation .* does not exist|could not find the table|schema cache/i.test(String(error?.message||''))) return {version:'BETAI_RELIABILITY_CONTROL_V190',health:'PENDING',freezeSnapshots:0,leakageBlocks:0,duplicateFixtures:0,settlementMismatches:0,settlementIntegrity:'PENDING'}
    return {version:'BETAI_RELIABILITY_CONTROL_V190',health:'PENDING',freezeSnapshots:0,leakageBlocks:0,duplicateFixtures:0,settlementMismatches:0,settlementIntegrity:'PENDING'}
  }
}

async function persistDataScienceProfilesV200(supabase, ds = {}) {
  const rows=[]
  for(const p of ds?.calibration?.marketProfiles||[]) rows.push({profile_key:`v200:market:${p.key}`,model_version:'BETAI_PREDICTION_ENGINE_4_V200',profile_type:'market',league:null,market_key:p.key,season_key:ds?.seasonDecay?.currentSeason||null,method:p.selectedMethod||'RAW',sample_size:n(p.samples),log_loss:n(p.selectedLogLoss||p.rawLogLoss),brier:null,parameters:p.parameters||{},validation:{status:p.status,validationSamples:p.validationSamples,improvement:p.improvement},updated_at:new Date().toISOString()})
  for(const l of ds?.calibration?.leagueProfiles||[]) for(const p of l.markets||[]) rows.push({profile_key:`v200:league:${l.league}:${p.key}`,model_version:'BETAI_PREDICTION_ENGINE_4_V200',profile_type:'league_market',league:l.league,market_key:p.key,season_key:ds?.seasonDecay?.currentSeason||null,method:p.selectedMethod||'RAW',sample_size:n(p.samples),log_loss:n(p.selectedLogLoss||p.rawLogLoss),brier:null,parameters:{...(p.parameters||{}),hierarchicalShrink:p.hierarchicalShrink},validation:{status:p.status,validationSamples:p.validationSamples,improvement:p.improvement},updated_at:new Date().toISOString()})
  if(!rows.length) return {available:false,profiles:0}
  const {error}=await supabase.from('match_data_science_profiles').upsert(rows,{onConflict:'profile_key'})
  if(error){if(/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message||'')))return{available:false,profiles:0};throw error}
  return {available:true,profiles:rows.length,updatedAt:new Date().toISOString()}
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
    try {
      shadowRows = await fetchShadowBets(supabase, 5000)
      paperPortfolio = aggregateShadowPortfolio(shadowRows)
    } catch (_) {}
    const errorAnalysis = buildErrorAnalysis(rows)
    const portfolioRisk = buildPortfolioRisk(shadowRows)
    let experimentRows = []
    try { experimentRows = await fetchModelExperimentsV160(supabase, 12000) } catch (_) {}
    const championChallenger = buildChampionChallengerV160(rows, experimentRows)
    const statisticalConfidence = buildStatisticalConfidenceV161(all, shadowRows)
    const autoGate = buildAutoGateV162(all, drift)
    const teamStrength = buildTeamStrengthV164(rows)
    const selfLearning = buildSelfLearningV174(experimentRows)
    try { selfLearning.profileStorage = await persistSelfLearningProfilesV174(supabase, selfLearning) } catch (_) { selfLearning.profileStorage = { available:false, changed:0, updatedAt:null } }
    const dataScience = buildDataScienceV200(rows, experimentRows, leagueTrust)
    try { dataScience.profileStorage = await persistDataScienceProfilesV200(supabase, dataScience) } catch (_) { dataScience.profileStorage = { available:false, profiles:0 } }
    const integrityControl = await fetchIntegrityControlV190(supabase)
    let registry = null
    try { registry = await fetchModelRegistryV173(supabase) } catch (_) {}
    let governance = buildGovernanceV173(experimentRows, registry)
    try { governance = await persistGovernanceV173(supabase, governance, registry) } catch (_) {}
    selfLearning.governance = governance
    selfLearning.brainDashboard = buildBrainDashboardV174(selfLearning, governance, all, leagueTrust)
    const controlCenter = buildControlCenter({ all, last30: last30Stats, drift, leagueTrust, versions, paperPortfolio, portfolioRisk, errorAnalysis, championChallenger, statisticalConfidence, autoGate })
    controlCenter.activeModelVersion = governance.activeVersion || controlCenter.activeModelVersion
    controlCenter.activeModel = governance.activeVersion === SELF_MODEL_V180 ? 'challenger' : 'champion'
    if (governance.action === 'PROMOTE') controlCenter.alerts.unshift('SELF LEARNING: V180 został automatycznie promowany po walidacji walk-forward.')
    if (governance.action === 'ROLLBACK') controlCenter.alerts.unshift('SELF LEARNING: wykonano automatyczny rollback do stabilnego Championa.')
    if (integrityControl.health === 'CRITICAL') controlCenter.alerts.unshift('DATA INTEGRITY: Reliability Control Center ma status CRITICAL.')
    if (dataScience.overfittingGuard?.level === 'HIGH') controlCenter.alerts.unshift('DATA SCIENCE: Overfitting Guard ma status HIGH — wagi są ograniczane shrinkage.')
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
      errorAnalysis,
      portfolioRisk,
      championChallenger,
      statisticalConfidence,
      autoGate,
      teamStrength,
      integrityControl,
      dataScience,
      selfLearning,
      modelGovernance: governance,
      modelBrain: selfLearning.brainDashboard,
      controlCenter,
      note: rows.length < 100 ? 'Mała próbka — wyniki kalibracji, drift i trust score będą stabilniejsze po zebraniu większej liczby meczów.' : ''
    })
  } catch (error) {
    return json(500, { ok: false, available: false, error: error?.message || String(error) })
  }
}

exports._test = { outcomes, predictionRecords, aggregateRows, calibration, valueRecord, walkForwardBacktest, buildDriftDetector, buildLeagueTrust, aggregateShadowPortfolio, buildErrorAnalysis, buildPortfolioRisk, buildControlCenter, buildChampionChallengerV160, buildStatisticalConfidenceV161, buildAutoGateV162, buildTeamStrengthV164, buildSelfLearningV174, buildGovernanceV173, buildAdaptiveCalibration, buildMarketWeightProfile, persistSelfLearningProfilesV174, buildDataScienceV200, evaluateBinaryCalibrationV198, evaluateOneXTwoTemperatureV198, fitPlattV193, fitIsotonicV192, bootstrapConfidenceV199, leagueBayesianPriorsV194 }
