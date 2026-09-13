import fs from 'node:fs'
import assert from 'node:assert/strict'
import { freezeCanonicalTopPickV400, mergeCanonicalTopV400, conservativeCanonicalDecisionV400 } from './src/fmAiCanonicalPipelineV400.js'
import { settleMarket } from './netlify/functions/_lib/fm-ai-system-tracker-v368.js'

const frozen = freezeCanonicalTopPickV400({
  key:'under25', probability:30.8, bookmakerOdds:4.64, bookmaker:'Pinnacle', fairOdds:3.25,
  noVigImplied:20.3, rawImplied:21.55, bookmakerMargin:6.1, threshold:5,
  decision:'STRONG_VALUE', edgePp:10.5, expectedValuePct:42.9,
  calibration:{samples:120}, reliability:{score:83}, marketConsensus:{sources:7,agreement:78},
  redFlags:[{code:'PRICE_OUTLIER',level:'WARN'}], hardBlocked:false
})
assert.equal(frozen.key,'under25')
assert.equal(frozen.bookmaker,'Pinnacle')
assert.equal(frozen.noVigImplied,20.3)
assert.equal(frozen.calibration.samples,120)
assert.equal(frozen.reliability.score,83)

const exact = mergeCanonicalTopV400({
  sharedTop:frozen,
  candidates:[
    {key:'over35',decision:'STRONG_VALUE',bookmaker:'WRONG',noVigImplied:44},
    {key:'under25',decision:'VALUE',bookmaker:'NEW',noVigImplied:22.1,threshold:7}
  ],
  disagreement:'LOW'
})
assert.equal(exact.key,'under25')
assert.equal(exact.decision,'VALUE','downstream may downgrade STRONG_VALUE -> VALUE')
assert.equal(exact.sourceDecision,'STRONG_VALUE')
assert.equal(exact.bookmaker,'Pinnacle','frozen market economics must win over later quote')
assert.equal(exact.noVigImplied,20.3,'frozen no-vig must stay coherent with frozen odds')
assert.equal(exact.exactMarketMatchedV400,true)

const missing = mergeCanonicalTopV400({
  sharedTop:frozen,
  candidates:[{key:'over35',decision:'STRONG_VALUE',bookmaker:'WRONG',noVigImplied:44,threshold:9}],
  disagreement:'LOW'
})
assert.equal(missing.key,'under25')
assert.equal(missing.bookmaker,'Pinnacle','must never borrow bookmaker from a different market')
assert.equal(missing.noVigImplied,20.3,'must never borrow no-vig from a different market')
assert.equal(missing.exactMarketMatchedV400,false)

assert.equal(conservativeCanonicalDecisionV400('VALUE','STRONG_VALUE','LOW'),'VALUE','downstream may not upgrade')
assert.equal(conservativeCanonicalDecisionV400('STRONG_VALUE','VALUE','LOW'),'VALUE','downstream downgrade allowed')
assert.equal(conservativeCanonicalDecisionV400('STRONG_VALUE','STRONG_VALUE','MEDIUM'),'VALUE','medium disagreement downgrades strong')
assert.equal(conservativeCanonicalDecisionV400('VALUE','VALUE','HIGH'),'NO_BET','high disagreement blocks action')
assert.equal(conservativeCanonicalDecisionV400('VALUE','NO_BET','LOW'),'NO_BET','current quality guard can block frozen signal')

assert.equal(settleMarket('under25',2,0),true)
assert.equal(settleMarket('under25',4,0),false)
assert.equal(settleMarket('over25',2,1),true)
assert.equal(settleMarket('bttsYes',2,1),true)
assert.equal(settleMarket('bttsNo',2,0),true)

const prep = fs.readFileSync('./src/MatchSimulatorPreparationView.jsx','utf8')
const daily = fs.readFileSync('./src/MatchSimulatorDailyMatchesView.jsx','utf8')
const live = fs.readFileSync('./src/MatchSimulatorView.jsx','utf8')
const engine = fs.readFileSync('./src/matchEngineV320.js','utf8')
const flow = fs.readFileSync('./src/MatchSimulatorFlowView.jsx','utf8')
assert(prep.includes('mergeCanonicalTopV400'))
assert(prep.includes('candidates: ranked,'),'all canonical market candidates must remain searchable')
assert(prep.includes('top3: [canonicalTopV400, ...remainingTop3V400].slice(0, 3)'),'top3 must remain exactly top 3')
assert(daily.includes('freezeCanonicalTopPickV400(dailyScan.topFinal)'),'board click freezes complete market economics')
assert(flow.includes('setPreparedData(data || null)'))
assert(live.includes('data?.predictionEngine?.sharedSnapshotV365?.topPick'))
assert(engine.includes('data?.predictionEngine?.sharedSnapshotV365?.topPick'))
assert(live.includes('sharedHardGuardV367 = false'))
assert(engine.includes('sharedHardGuardV367 = false'))

console.log('V400 CANONICAL PIPELINE AUDIT: 27 assertions PASS')
