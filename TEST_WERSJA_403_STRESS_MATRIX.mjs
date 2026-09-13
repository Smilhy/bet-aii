import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { classifyValueCandidateV347 } from './src/valuePolicyV347.js'
import { applyFrozenTrackerPickV402 } from './src/fmAiTrackerFreezeV402.js'
import { mergeCanonicalTopV400, canonicalUiActionV402 } from './src/fmAiCanonicalPipelineV400.js'
import { scoreMatchesFmAiMarketV367 } from './src/fmAiConsistencyV367.js'
const require=createRequire(import.meta.url)
const serverPolicy=require('./netlify/functions/_lib/fm-ai-value-policy-v374.js')
const { settleMarket }=require('./netlify/functions/_lib/fm-ai-system-tracker-v368.js')
const markets=['home','draw','away','over15','under15','over25','under25','over35','under35','bttsYes','bttsNo']
const decisions=['NO_ODDS','NO_BET','SMALL_EDGE','VALUE','STRONG_VALUE']
const rank={NO_ODDS:0,NO_BET:1,SMALL_EDGE:2,VALUE:3,STRONG_VALUE:4}
let seed=0x12345678
const rnd=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32}
for(let i=0;i<100000;i++){
  const key=markets[(rnd()*markets.length)|0]
  const cand={key,edgePp:rnd()*40-8,expectedValuePct:rnd()*65-12,vigAdjusted:rnd()>.06,calibration:{status:['PENDING','GOOD','OK','POOR'][(rnd()*4)|0],samples:(rnd()*250)|0,leaguePenalty:Math.round(rnd()*30)/10}}
  const ctx={dataQuality:Math.round(45+rnd()*55),modelAgreement:Math.round(25+rnd()*75),marketScore:Math.round(20+rnd()*80),consensusSources:(rnd()*6)|0,consensusAgreement:Math.round(20+rnd()*80),marketDriftStatus:['PENDING','WATCH','DRIFT'][(rnd()*3)|0],leagueTrustScore:rnd()<.08?null:Math.round(25+rnd()*75),priceMoveAgainstPp:rnd()<.3?Math.round((rnd()*30-15)*10)/10:null}
  const a=classifyValueCandidateV347(cand,ctx),b=serverPolicy.classify(cand,ctx)
  assert.equal(a.decision,b.decision,`policy decision mismatch @${i}`)
  assert.equal(a.threshold,b.threshold,`policy threshold mismatch @${i}`)
  assert.equal(a.reliabilityScore,b.reliabilityScore,`policy reliability mismatch @${i}`)
  assert.equal(a.hardBlocked,b.hardBlocked,`policy hard block mismatch @${i}`)
  assert.deepEqual((a.redFlags||[]).map(x=>`${x.level}:${x.code}`).sort(),(b.redFlags||[]).map(x=>`${x.level}:${x.code}`).sort(),`policy flags mismatch @${i}`)
}
for(let i=0;i<50000;i++){
  const key=markets[(rnd()*markets.length)|0],other=markets.filter(x=>x!==key)[(rnd()*(markets.length-1))|0]
  const sourceDecision=decisions[(rnd()*decisions.length)|0],currentDecision=decisions[(rnd()*decisions.length)|0]
  const p=Math.round(rnd()*1000)/10,odds=Math.round((1.01+rnd()*9)*100)/100
  const tracker={id:`i${i}`,fixtureId:`f${i}`,key,decision:sourceDecision,odds,probability:p,fairOdds:p>0?100/p:0,edgePp:rnd()*20-5,expectedValuePct:rnd()*40-5,reliability:Math.round(rnd()*100),dailyScore:Math.round(rnd()*100),bookmaker:'Frozen'}
  const exact={key,decision:currentDecision,probability:Math.min(100,p+3),bookmakerOdds:odds+.1,fairOdds:p>0?100/Math.max(.1,p):0,edgePp:7,expectedValuePct:10,reliability:{score:90}}
  const frozen=applyFrozenTrackerPickV402({candidates:[exact,{...exact,key:other,decision:'STRONG_VALUE'}],topFinal:{key:other,decision:'STRONG_VALUE'}},tracker)
  assert.equal(frozen.topFinal.key,key,`market changed freeze @${i}`)
  assert.equal(frozen.topFinal.bookmakerOdds,odds,`odds changed freeze @${i}`)
  const merged=mergeCanonicalTopV400({sharedTop:frozen.topFinal,candidates:[exact],disagreement:['LOW','MEDIUM','HIGH'][(rnd()*3)|0]})
  assert.equal(merged.key,key,`market changed merge @${i}`)
  assert.ok(rank[merged.decision]<=rank[sourceDecision],`decision upgraded @${i}`)
  const ui=canonicalUiActionV402(sourceDecision,p,'BET')
  const base=(sourceDecision==='VALUE'||sourceDecision==='STRONG_VALUE')?(p>=55?'BET':'WATCH'):sourceDecision==='SMALL_EDGE'?'WATCH':'NO_BET'
  assert.ok(({NO_BET:0,WATCH:1,BET:2})[ui]<=({NO_BET:0,WATCH:1,BET:2})[base],`UI upgraded @${i}`)
}
let settlement=0
for(const key of markets)for(let h=0;h<=15;h++)for(let a=0;a<=15;a++){assert.equal(scoreMatchesFmAiMarketV367({home:h,away:a},key),settleMarket(key,h,a));settlement++}
console.log(`V403 STRESS MATRIX PASS: policy=100000, canonical=50000, settlement=${settlement}`)
