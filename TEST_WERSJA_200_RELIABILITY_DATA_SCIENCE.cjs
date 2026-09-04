const assert = require('assert')
const Module = require('module')
const originalLoad = Module._load
Module._load = function(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => ({}) }
  return originalLoad.apply(this, arguments)
}
const perf = require('./netlify/functions/get-match-prediction-performance.js')._test

function makeRow(i) {
  const homeWin = i % 3 === 0
  const draw = i % 3 === 1
  const score = homeWin ? [2,0] : draw ? [1,1] : [0,2]
  const total = score[0] + score[1]
  // Intentionally overconfident probabilities. OOS calibration should have enough data
  // to evaluate RAW vs Platt/Isotonic/Temperature without reading future outcomes.
  const oneXTwo = homeWin ? {home:86,draw:8,away:6} : draw ? {home:12,draw:76,away:12} : {home:6,draw:8,away:86}
  const goals = {
    over15: total >= 2 ? 88 : 12,
    over25: total >= 3 ? 84 : 16,
    over35: total >= 4 ? 78 : 22,
    btts: score[0] > 0 && score[1] > 0 ? 84 : 16
  }
  // Every 5th prediction is noisy, making calibration non-trivial.
  if (i % 5 === 0) {
    goals.over25 = 100 - goals.over25
    goals.btts = 100 - goals.btts
  }
  const t = new Date(Date.UTC(2026, 7, 1) + i * 6 * 3600 * 1000).toISOString()
  return {
    fixture_id:String(i+1), fixture_date:t, settled_at:t,
    home_team:'Home', away_team:'Away', league:i%2?'Premier League':'Serie A', country:'X',
    model_version:'BETAI_FORECAST_V200', data_quality:90,
    actual_home_goals:score[0], actual_away_goals:score[1],
    forecast:{ oneXTwo, goals }
  }
}
const rows = Array.from({length:180}, (_,i)=>makeRow(i))
const ds = perf.buildDataScienceV200(rows, [], [])
assert.equal(ds.version, 'BETAI_DATA_SCIENCE_LAB_V200')
assert(ds.decisionQuality.samples === 180)
assert(ds.decisionQuality.logLoss > 0)
assert(ds.calibration.marketProfiles.length === 5)
assert(ds.calibration.marketProfiles.find(x=>x.key==='oneXTwo').validationSamples > 0)
assert(ds.bootstrap.reps > 0)
assert(ds.bootstrap.brier95.high >= ds.bootstrap.brier95.low)
assert(ds.bayesianPriors.length >= 2)
assert(['LOW','MEDIUM','HIGH'].includes(ds.overfittingGuard.level))
assert(['BASE','CALIBRATED_STACK'].includes(ds.autoSelection.winner))

const obs = Array.from({length:120},(_,i)=>({p:i%2?0.8:0.2,y:i%2?1:0,time:i}))
const cal = perf.evaluateBinaryCalibrationV198(obs)
assert(cal.validationSamples > 0)
assert(['RAW','PLATT','ISOTONIC'].includes(cal.selectedMethod))

console.log('V200 RELIABILITY + DATA SCIENCE TEST OK', {
  logLoss: ds.decisionQuality.logLoss,
  bootstrap: ds.bootstrap,
  autoSelection: ds.autoSelection,
  calibrators: ds.calibration.marketProfiles.map(x=>[x.key,x.selectedMethod,x.validationSamples])
})
