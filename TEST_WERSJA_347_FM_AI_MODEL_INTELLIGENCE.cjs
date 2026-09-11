const fs = require('fs')
const assert = require('assert')
const { pathToFileURL } = require('url')
const Module = require('module')
const originalLoad = Module._load
Module._load = function patched(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => null }
  return originalLoad.apply(this, arguments)
}

async function loadPolicy() {
  const source = fs.readFileSync('src/valuePolicyV347.js', 'utf8')
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return import(url)
}

;(async () => {
  const { classifyValueCandidateV347, VALUE_POLICY_V347 } = await loadPolicy()
  const base = {
    key: 'over25', probability: 66, fairOdds: 1.52, bookmakerOdds: 1.95,
    noVigImplied: 52, edgePp: 14, expectedValuePct: 28.7, vigAdjusted: true,
    calibration: { status: 'GOOD', samples: 120, source: 'league', leaguePenalty: 0 }
  }
  const good = classifyValueCandidateV347(base, {
    dataQuality: 94, modelAgreement: 82, marketScore: 91, consensusSources: 4,
    consensusAgreement: 89, marketDriftStatus: 'STABLE', leagueTrustScore: 84
  })
  assert.strictEqual(good.decision, 'STRONG_VALUE', 'healthy candidate should be STRONG_VALUE')
  assert.strictEqual(good.hardBlocked, false)

  const smallSample = classifyValueCandidateV347({ ...base, calibration: { ...base.calibration, samples: 36 } }, {
    dataQuality: 94, modelAgreement: 82, marketScore: 91, consensusSources: 4,
    consensusAgreement: 89, marketDriftStatus: 'STABLE', leagueTrustScore: 84
  })
  assert.strictEqual(smallSample.decision, 'VALUE', '36 samples may be VALUE but not STRONG_VALUE')
  assert(smallSample.redFlags.some(x => x.code === 'STRONG_SAMPLE'))

  const disagree = classifyValueCandidateV347(base, {
    dataQuality: 94, modelAgreement: 40, marketScore: 91, consensusSources: 4,
    consensusAgreement: 89, marketDriftStatus: 'STABLE', leagueTrustScore: 84
  })
  assert.strictEqual(disagree.decision, 'NO_BET')
  assert(disagree.redFlags.some(x => x.code === 'MODEL_DISAGREEMENT' && x.level === 'BLOCK'))

  const drift = classifyValueCandidateV347(base, {
    dataQuality: 94, modelAgreement: 82, marketScore: 91, consensusSources: 4,
    consensusAgreement: 89, marketDriftStatus: 'DRIFT', leagueTrustScore: 84
  })
  assert.strictEqual(drift.decision, 'NO_BET')
  assert(drift.redFlags.some(x => x.code === 'MODEL_DRIFT'))

  assert.strictEqual(VALUE_POLICY_V347.minStrongCalibrationSamples, 100)
  assert.strictEqual(VALUE_POLICY_V347.minStrongModelAgreement, 65)

  const scanner = require('./netlify/functions/get-match-value-scan.js')._test
  const consensus = scanner.buildMarketConsensusV347([
    { bookmaker:'A', over25:1.95, under25:1.91 },
    { bookmaker:'B', over25:1.90, under25:1.96 },
    { bookmaker:'C', over25:1.93, under25:1.93 }
  ])
  assert.strictEqual(consensus.over25.sources, 3)
  assert(consensus.over25.agreement >= 70, 'consensus agreement should be healthy for close prices')
  assert(consensus.over25.avgNoVigProbability > 45 && consensus.over25.avgNoVigProbability < 55)

  const perf = require('./netlify/functions/get-match-prediction-performance.js')._test
  const health = perf.buildModelHealthV347({ matches:120, avgBrier:.21, calibrationError:4.2, valueRoi:5.1, valueHitRate:58, avgRecordedEdge:8, clvSamples:30, avgClv:2.4 }, { matches:30, valueRoi:4, valueHitRate:57, avgBrier:.22 }, { matches:100, valueRoi:5, valueHitRate:58, avgBrier:.21 }, { markets:[{status:'STABLE'}] })
  assert.strictEqual(health.status, 'GOOD')

  const daily = fs.readFileSync('src/MatchSimulatorDailyMatchesView.jsx', 'utf8')
  for (const marker of ['MODEL INTELLIGENCE CENTER V347','CLV TRACKER','WHY AI','PREDICTION TIMELINE','TOP PICKS 2.0','MARKET CONSENSUS','RED FLAG GUARD']) {
    assert(daily.includes(marker), `Daily FM AI missing marker: ${marker}`)
  }
  const prep = fs.readFileSync('src/MatchSimulatorPreparationView.jsx', 'utf8')
  assert(prep.includes('RED FLAG GUARD V347'), 'Full FM AI analysis missing Red Flag Guard')
  assert(prep.includes('classifyValueCandidateV347'), 'Full FM AI analysis does not share V347 policy')

  console.log('TEST_WERSJA_347_FM_AI_MODEL_INTELLIGENCE: OK')
})().catch(error => { console.error(error); process.exit(1) })
