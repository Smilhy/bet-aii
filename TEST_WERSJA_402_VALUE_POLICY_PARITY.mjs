import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { classifyValueCandidateV347 } from './src/valuePolicyV347.js'
const require=createRequire(import.meta.url)
const server=require('./netlify/functions/_lib/fm-ai-value-policy-v374.js')
let mismatches=[]
for(let i=0;i<1000;i++){
  const cand={key:['home','draw','away','over25','under25','bttsYes','bttsNo'][i%7],edgePp:(i*7%320)/10-4,expectedValuePct:(i*13%500)/10-8,vigAdjusted:i%19!==0,calibration:{status:['PENDING','GOOD','OK','POOR'][i%4],samples:(i*17)%160,leaguePenalty:(i%3)*.5}}
  const ctx={dataQuality:55+(i*11)%46,modelAgreement:35+(i*13)%66,marketScore:30+(i*19)%71,consensusSources:i%5,consensusAgreement:30+(i*23)%71,marketDriftStatus:['PENDING','WATCH','DRIFT'][i%3],leagueTrustScore:i%7===0?null:35+(i*29)%66}
  const a=classifyValueCandidateV347(cand,ctx)
  const b=server.classify(cand,ctx)
  if(a.decision!==b.decision || a.threshold!==b.threshold || a.reliabilityScore!==b.reliabilityScore || a.hardBlocked!==b.hardBlocked){mismatches.push({i,a:{d:a.decision,t:a.threshold,r:a.reliabilityScore,h:a.hardBlocked},b:{d:b.decision,t:b.threshold,r:b.reliabilityScore,h:b.hardBlocked}}); if(mismatches.length>=10)break}
}
assert.equal(mismatches.length,0, `client/server value-policy mismatch: ${JSON.stringify(mismatches)}`)
console.log('V402 VALUE POLICY PARITY: 1000 deterministic cases PASS')
