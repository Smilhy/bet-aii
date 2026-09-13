import fs from 'node:fs'
import assert from 'node:assert/strict'
import { mergeCanonicalTopV400, canonicalUiActionV402 } from './src/fmAiCanonicalPipelineV400.js'
import { classifyValueCandidateV347 } from './src/valuePolicyV347.js'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const serverPolicy=require('./netlify/functions/_lib/fm-ai-value-policy-v374.js')

// 1) Missing exact market must fail closed while identity remains frozen.
const frozen={key:'under25',decision:'VALUE',probability:31,bookmakerOdds:4.2,fairOdds:3.23,edgePp:7,expectedValuePct:30}
const merged=mergeCanonicalTopV400({sharedTop:frozen,candidates:[{key:'over25',decision:'STRONG_VALUE',probability:69,bookmakerOdds:1.7}],disagreement:'LOW'})
assert.equal(merged.key,'under25')
assert.equal(merged.decision,'NO_BET')
assert.equal(merged.validationMissingV403,true)
assert.equal(canonicalUiActionV402('VALUE',31,merged.decision),'NO_BET')

// 2) Client/server policy must both hard-block adverse price movement.
const cand={key:'away',edgePp:12,expectedValuePct:18,vigAdjusted:true,calibration:{status:'GOOD',samples:140,leaguePenalty:0}}
const ctx={dataQuality:95,modelAgreement:85,marketScore:85,consensusSources:4,consensusAgreement:90,marketDriftStatus:'PENDING',leagueTrustScore:80,priceMoveAgainstPp:-9}
const c=classifyValueCandidateV347(cand,ctx)
const s=serverPolicy.classify(cand,ctx)
assert.equal(c.hardBlocked,true)
assert.equal(s.hardBlocked,true)
assert.equal(c.decision,'NO_BET')
assert.equal(s.decision,'NO_BET')
assert(c.redFlags.some(x=>x.code==='PRICE_MOVE_AGAINST'))
assert(s.redFlags.some(x=>x.code==='PRICE_MOVE_AGAINST'))

// 3) Existing frozen record must be checked before current-actionable gate.
const daily=fs.readFileSync('./src/MatchSimulatorDailyMatchesView.jsx','utf8')
const start=daily.indexOf('const ensureCanonicalTrackerFreezeV402')
const frozenIdx=daily.indexOf('findFrozenTrackerPickV402(trackerPayload, fixtureId)',start)
const gateIdx=daily.indexOf('if (!actionableV403) return dailyScan',start)
assert(start>=0&&frozenIdx>start&&gateIdx>frozenIdx,'existing frozen record must win before current decision gate')

// 4) Server recorder must choose canonical server top and frozen economics.
const recorder=fs.readFileSync('./netlify/functions/record-fm-ai-system-pick.js','utf8')
for(const marker of [
  "const enrichedV403=enrichScan(snap.payload,performanceV403)",
  "const serverCandidate=enrichedV403?.topFinal||null",
  "ai_probability:num(serverCandidate.probability,null)",
  "edge_pp:num(serverCandidate.edgePp,null)",
  "serverAuthoritativeV403:true",
  "firstPublishedWinsV403:true"
]) assert(recorder.includes(marker),`missing recorder authority marker: ${marker}`)

console.log('V403 CANONICAL GUARDS: PASS')
