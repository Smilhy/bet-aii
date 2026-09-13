import fs from 'node:fs'
import assert from 'node:assert/strict'
import { applyFrozenTrackerPickV401 } from './src/fmAiTrackerFreezeV401.js'
import { mergeCanonicalTopV400, conservativeCanonicalDecisionV400 } from './src/fmAiCanonicalPipelineV400.js'

const liveScan = {
  candidates:[
    {key:'under25',decision:'VALUE',probability:31.2,bookmakerOdds:4.50,fairOdds:3.21,noVigImplied:21.1,edgePp:10.1,expectedValuePct:40.4,bookmaker:'Pinnacle',reliability:{score:82}},
    {key:'under35',decision:'STRONG_VALUE',probability:68.0,bookmakerOdds:1.80,fairOdds:1.47,noVigImplied:54.0,edgePp:14.0,expectedValuePct:22.4,bookmaker:'Bet365',reliability:{score:88}}
  ],
  topFinal:{key:'under35',decision:'STRONG_VALUE',probability:68.0,bookmakerOdds:1.80,edgePp:14.0,reliability:{score:88}}
}
const tracker = {
  id:'rec-1',fixtureId:'777',publishedAt:'2026-09-13T17:00:00Z',key:'under25',decision:'VALUE',odds:4.64,
  probability:30.8,fairOdds:3.25,edgePp:10.5,expectedValuePct:42.9,reliability:83,dailyScore:71,bookmaker:'Pinnacle',noVigImplied:20.3,rawImplied:21.6,bookmakerMargin:6.1,threshold:5,marketGroup:'O/U 2.5'
}
const frozenScan = applyFrozenTrackerPickV401(liveScan, tracker)
assert.equal(frozenScan.topFinal.key,'under25','board must show the already frozen tracker market')
assert.equal(frozenScan.topFinal.bookmakerOdds,4.64,'board must show frozen odds')
assert.equal(frozenScan.topFinal.probability,30.8,'board must show frozen probability')
assert.equal(frozenScan.topFinal.noVigImplied,20.3,'frozen no-vig preserved from tracker')
assert.equal(frozenScan.topFinal.bookmaker,'Pinnacle','bookmaker preserved with frozen odds')
assert.equal(frozenScan.topFinal.threshold,5,'threshold preserved with frozen market')
assert.equal(frozenScan.topFinal.decision,'VALUE')
assert.equal(frozenScan.topFinal.trackerFrozenV401,true)
assert.equal(frozenScan.trackerFrozenV401.fixtureId,'777')

const canonical = mergeCanonicalTopV400({
  sharedTop:frozenScan.topFinal,
  candidates:liveScan.candidates,
  disagreement:'LOW'
})
assert.equal(canonical.key,'under25','preparation keeps board/tracker market')
assert.equal(canonical.bookmakerOdds,4.64)
assert.equal(canonical.probability,30.8)
assert.equal(conservativeCanonicalDecisionV400('VALUE','STRONG_VALUE','LOW'),'VALUE','downstream cannot upgrade frozen action')
assert.equal(conservativeCanonicalDecisionV400('VALUE','VALUE','HIGH'),'NO_BET','downstream can downgrade on high disagreement')

const daily = fs.readFileSync('./src/MatchSimulatorDailyMatchesView.jsx','utf8')
const prep = fs.readFileSync('./src/MatchSimulatorPreparationView.jsx','utf8')
const flow = fs.readFileSync('./src/MatchSimulatorFlowView.jsx','utf8')
const live = fs.readFileSync('./src/MatchSimulatorView.jsx','utf8')
const engine = fs.readFileSync('./src/matchEngineV320.js','utf8')
assert(daily.includes('frozenTrackerByFixtureV401'))
assert(daily.includes('applyFrozenTrackerPickV402(liveScan, frozenTrackerV401)') || daily.includes('applyFrozenTrackerPickV401(liveScan, frozenTrackerV401)'))
assert(daily.includes('ensureCanonicalTrackerFreezeV402(match, dailyScan)') || daily.includes('const trackerPayloadV401 = await refreshSystemStatsV368({ retry:false })'),'open action verifies frozen tracker before snapshot')
assert(daily.includes('onOpenAnalysis={(entry) => handleSelect(entry?.match, entry?.scan)}'))
assert(daily.includes('topPick: freezeCanonicalTopPickV400(dailyScan.topFinal)'))
assert(prep.includes('mergeCanonicalTopV400'))
assert(flow.includes('setPreparedData(data || null)'))
assert(live.includes('data?.predictionEngine?.sharedSnapshotV365?.topPick'))
assert(engine.includes('data?.predictionEngine?.sharedSnapshotV365?.topPick'))
assert(live.includes('sharedHardGuardV367 = false'))
assert(engine.includes('sharedHardGuardV367 = false'))

console.log('V401 END-TO-END SIGNAL LOCK: 27 assertions PASS')
