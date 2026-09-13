import fs from 'node:fs'
import assert from 'node:assert/strict'
import { applyFrozenTrackerPickV402, findFrozenTrackerPickV402, frozenTrackerRowsV402 } from './src/fmAiTrackerFreezeV402.js'
import { mergeCanonicalTopV400, conservativeCanonicalDecisionV400, canonicalUiActionV402 } from './src/fmAiCanonicalPipelineV400.js'

// 1) Active frozen rows must beat short recent history and remain discoverable.
const payload = {
  activeFrozenV402:[{fixtureId:'777',key:'under25',odds:4.64,probability:30.8,decision:'VALUE'}],
  verifiedRecordV376:{records:[{fixtureId:'777',key:'under35',odds:1.8,probability:68,decision:'STRONG_VALUE'},{fixtureId:'888',key:'home'}]},
  recent:[{fixtureId:'999',key:'away'}]
}
const frozenRows = frozenTrackerRowsV402(payload)
assert.equal(frozenRows.length,3)
assert.equal(findFrozenTrackerPickV402(payload,'777')?.key,'under25','active frozen record must have priority')
assert.equal(findFrozenTrackerPickV402(payload,'888')?.key,'home')
assert.equal(findFrozenTrackerPickV402(payload,'999')?.key,'away')

// 2) Legacy tracker rows with 0/missing optional fields must not zero-out the exact market.
const liveScan = {
  candidates:[
    {key:'under25',decision:'VALUE',probability:31.2,bookmakerOdds:4.50,fairOdds:3.21,noVigImplied:21.1,edgePp:10.1,expectedValuePct:40.4,bookmaker:'Pinnacle',dailyScore:74,reliability:{score:82},redFlags:[]},
    {key:'under35',decision:'STRONG_VALUE',probability:68,bookmakerOdds:1.80,fairOdds:1.47,noVigImplied:54,edgePp:14,expectedValuePct:22.4,bookmaker:'Bet365',reliability:{score:88}}
  ],
  topFinal:{key:'under35',decision:'STRONG_VALUE'}
}
const legacyTracker = {
  id:'rec-legacy',fixtureId:'777',publishedAt:'2026-09-13T17:00:00Z',key:'under25',decision:'VALUE',
  odds:0,probability:0,fairOdds:0,edgePp:0,expectedValuePct:0,reliability:0,dailyScore:0,
  noVigImplied:null,bookmaker:'Pinnacle'
}
const legacyFrozen = applyFrozenTrackerPickV402(liveScan, legacyTracker)
assert.equal(legacyFrozen.topFinal.key,'under25')
assert.equal(legacyFrozen.topFinal.probability,31.2)
assert.equal(legacyFrozen.topFinal.bookmakerOdds,4.5)
assert.equal(legacyFrozen.topFinal.fairOdds,3.21)
assert.equal(legacyFrozen.topFinal.edgePp,10.1)
assert.equal(legacyFrozen.topFinal.expectedValuePct,40.4)
assert.equal(legacyFrozen.topFinal.reliability.score,82)
assert.equal(legacyFrozen.topFinal.noVigImplied,21.1,'missing no-vig must not be derived from a fake zero edge')

// 3) Real frozen economics remain authoritative.
const tracker = {
  id:'rec-1',fixtureId:'777',publishedAt:'2026-09-13T17:00:00Z',key:'under25',decision:'VALUE',odds:4.64,
  probability:30.8,fairOdds:3.25,edgePp:10.5,expectedValuePct:42.9,reliability:83,dailyScore:71,bookmaker:'Pinnacle',noVigImplied:20.3,rawImplied:21.6,bookmakerMargin:6.1,threshold:5,marketGroup:'O/U 2.5'
}
const frozen = applyFrozenTrackerPickV402(liveScan, tracker)
assert.equal(frozen.topFinal.bookmakerOdds,4.64)
assert.equal(frozen.topFinal.probability,30.8)
assert.equal(frozen.topFinal.noVigImplied,20.3)
assert.equal(frozen.topFinal.trackerFrozenV402,true)

// 4) Full analysis may downgrade and refresh risk metadata, but not switch market/economics.
const sharedTop = {
  ...frozen.topFinal,
  redFlags:[],redFlagCount:0,hardBlocked:false,
  reliability:{score:83,label:'HIGH'}
}
const currentCandidate = {
  key:'under25',decision:'NO_BET',probability:45,bookmakerOdds:3.8,edgePp:2,
  redFlags:[{level:'BLOCK',code:'MODEL_DRIFT'}],redFlagCount:1,hardBlocked:true,driftStatus:'DRIFT',
  reliability:{score:48,label:'LOW'}
}
const canonical = mergeCanonicalTopV400({sharedTop,candidates:[currentCandidate],disagreement:'LOW'})
assert.equal(canonical.key,'under25')
assert.equal(canonical.bookmakerOdds,4.64,'frozen price economics must remain fixed')
assert.equal(canonical.probability,30.8,'frozen probability must remain fixed')
assert.equal(canonical.decision,'NO_BET','full analysis may downgrade')
assert.equal(canonical.hardBlocked,true,'current guard metadata must be shown')
assert.equal(canonical.redFlags[0]?.code,'MODEL_DRIFT')
assert.equal(canonical.publishedRiskSnapshotV402.hardBlocked,false,'published risk state remains auditable')
assert.equal(canonical.riskRefreshedV402,true)
assert.equal(conservativeCanonicalDecisionV400('VALUE','STRONG_VALUE','LOW'),'VALUE')
assert.equal(conservativeCanonicalDecisionV400('STRONG_VALUE','VALUE','MEDIUM'),'VALUE')
assert.equal(conservativeCanonicalDecisionV400('VALUE','VALUE','HIGH'),'NO_BET')
assert.equal(canonicalUiActionV402('VALUE',30.8,'BET'),'WATCH','low-probability VALUE cannot be visually upgraded to BET')
assert.equal(canonicalUiActionV402('VALUE',61,'NO_BET'),'NO_BET','Professional Lab downgrade must reach every UI layer')
assert.equal(canonicalUiActionV402('STRONG_VALUE',72,'WATCH'),'WATCH','WATCH downgrade must be preserved')
assert.equal(canonicalUiActionV402('SMALL_EDGE',78,'BET'),'WATCH','SMALL_EDGE cannot be upgraded to BET')

// 5) Static end-to-end guards.
const daily = fs.readFileSync('./src/MatchSimulatorDailyMatchesView.jsx','utf8')
const prep = fs.readFileSync('./src/MatchSimulatorPreparationView.jsx','utf8')
const live = fs.readFileSync('./src/MatchSimulatorView.jsx','utf8')
const stats = fs.readFileSync('./netlify/functions/get-fm-ai-system-stats.js','utf8')
const record = fs.readFileSync('./netlify/functions/record-fm-ai-system-pick.js','utf8')
const board = fs.readFileSync('./src/FmAiProMarketSuiteV377.jsx','utf8')
assert(daily.includes("BETAI_FM_AI_SHARED_SNAPSHOT_V402"))
assert(daily.includes('frozenTrackerRowsV402(systemStatsV368)'))
assert(daily.includes('ensureCanonicalTrackerFreezeV402'))
assert(daily.includes("recordedFrom:'FM_AI_OPEN_HANDSHAKE_V404'") || daily.includes("recordedFrom:'FM_AI_OPEN_HANDSHAKE_V402'"), 'open action must synchronously resolve/freeze canonical pick before preparation')
assert(daily.includes('return applyFrozenTrackerPickV402(dailyScan, frozen)') || daily.includes('return applyFrozenTrackerForOpenV405(dailyScan, frozen)'), 'open handshake must use server-confirmed frozen record')
assert(daily.includes('payload?.canonicalFrozenV404?.fixtureId') || daily.includes("throw new Error('Tracker zapisał typ, ale nie udało się potwierdzić rekordu."), 'open handshake must consume server-confirmed canonical record')
assert(stats.includes('activeFrozenV402'))
assert(record.includes("String(error.code||'') === '23505'"),'unique insert race must resolve as duplicate')
assert(record.includes('raceResolvedV402:true'))
assert(prep.includes('selectedMarketSpreadPpV402'))
assert(prep.includes('selectedMarketDisagreementV402'))
assert(prep.includes('masterConsensusGuard: canonicalGuardV402'))
assert(live.includes('Scenariusz jest probabilistyczny i może trafić lub nie trafić zamrożonego sygnału FM AI.'))
assert(board.includes('Niska szansa trafienia'))
assert(board.includes('probability * 0.65 + rel * 0.35'))
assert(board.includes('confidenceScore = Math.min(confidenceScore, 49)'))
assert(prep.includes('const confidence = clampNum(Number(quickSummaryV321.primaryProbability || 0), 0, 100)'), 'Featured Match ring must show selection hit probability, not reliability')
assert(prep.includes('featuredReliabilityV402'), 'Featured Match must keep reliability as a separate metric')
assert(prep.includes('<small>AI CHANCE</small>'), 'Featured Match ring label must say AI CHANCE')
assert(prep.includes('<small>RELIABILITY</small>'), 'Featured Match reliability metric must be explicitly labelled')
assert(prep.includes('canonicalUiActionV402(frozenDecisionV398, frozenProbabilityV398, downstreamDecisionV402)'), 'Quick Summary must use shared canonical UI action resolver')
assert(prep.includes('wasDowngradedV402'), 'Quick Summary must explain a conservative downgrade')
assert(live.includes('canonicalUiActionV402(sharedSignalDecisionV398, sharedSignalProbabilityV398'), 'LIVE must use shared canonical UI action resolver')
assert(live.includes("'NO BET • BLOKADA RYZYKA'"), 'LIVE must label blocked canonical signal explicitly')
assert(live.includes("'WATCH • OBSERWUJ'"), 'LIVE must label WATCH downgrade explicitly')

console.log('V402 DEEP CANONICAL PIPELINE AUDIT: 57 assertions PASS')
