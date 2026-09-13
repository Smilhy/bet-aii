// V374 — server-side mirror of FM AI V347 value classification.
// Keeps the autonomous tracker aligned with the Daily FM AI scanner.
const VALUE_POLICY = Object.freeze({
  minCalibrationSamples:30,minStrongCalibrationSamples:100,minStrongModelAgreement:65,minStrongReliability:82,minStrongDataQuality:88,
  minStrongEvPct:8,minStrongMarketScore:70,minStrongLeagueTrust:55,strongEdgeExtraPp:5,minValueEvPct:3,minValueReliability:62,
  minModelAgreement:45,hardBlockConsensusAgreement:45,hardBlockLeagueTrust:42,outlierEdgePp:22,outlierEvPct:30
})
const n=(v,d=0)=>{const x=Number(v);return Number.isFinite(x)?x:d}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,n(v,min)))
const round1=v=>Math.round((n(v)+Number.EPSILON)*10)/10
function baseEdgeThreshold(key=''){if(['home','draw','away'].includes(key))return 6;if(['bttsYes','bttsNo','btts'].includes(key))return 5.5;return 5}
function calibrationScore(c={}){const s=String(c?.status||'PENDING').toUpperCase();return s==='GOOD'?92:s==='OK'?76:s==='POOR'?28:45}
function classify(candidate={},ctx={}){
  const quality=n(ctx.dataQuality), modelAgreement=n(ctx.modelAgreement,65), consensusSources=n(ctx.consensusSources), consensusAgreement=n(ctx.consensusAgreement)
  const marketScore=n(ctx.marketScore,consensusSources>0?consensusAgreement:55), drift=String(ctx.marketDriftStatus||'PENDING').toUpperCase()
  const leagueTrust=ctx.leagueTrustScore==null?null:n(ctx.leagueTrustScore), priceMoveAgainstPp=ctx.priceMoveAgainstPp==null?null:n(ctx.priceMoveAgainstPp), calibration=candidate?.calibration||{}, samples=n(calibration?.samples)
  let threshold=baseEdgeThreshold(candidate?.key||'')
  if(quality<75)threshold+=4; else if(quality<85)threshold+=2.5; else if(quality<92)threshold+=1
  if(String(calibration?.status||'').toUpperCase()==='OK')threshold+=.75
  threshold+=n(calibration?.leaguePenalty)
  if(consensusSources>=2&&consensusAgreement<60)threshold+=1
  if(modelAgreement<60)threshold+=1.5
  if(modelAgreement<50)threshold+=2
  if(drift==='WATCH')threshold+=1.25
  if(leagueTrust!=null&&leagueTrust<60)threshold+=1
  threshold=round1(threshold)
  const calScore=calibrationScore(calibration)
  const reliabilityScore=Math.round(clamp(quality*.38+modelAgreement*.20+calScore*.24+marketScore*.18,0,100))
  const calStatus=String(calibration?.status||'PENDING').toUpperCase()
  const reliabilityLabel=calStatus==='PENDING'?'PENDING':calStatus==='POOR'||reliabilityScore<65?'LOW':reliabilityScore>=82?'HIGH':'MEDIUM'
  const edge=n(candidate?.edgePp), ev=n(candidate?.expectedValuePct)
  const strongPrice=edge>=threshold+VALUE_POLICY.strongEdgeExtraPp&&ev>=VALUE_POLICY.minStrongEvPct
  const strongSample=samples>=VALUE_POLICY.minStrongCalibrationSamples, strongAgreement=modelAgreement>=VALUE_POLICY.minStrongModelAgreement
  const strongMarket=marketScore>=VALUE_POLICY.minStrongMarketScore, strongLeague=leagueTrust==null||leagueTrust>=VALUE_POLICY.minStrongLeagueTrust
  const redFlags=[]
  if(quality<75)redFlags.push({level:'BLOCK',code:'LOW_DATA_QUALITY'}); else if(quality<88)redFlags.push({level:'WARN',code:'DATA_QUALITY'})
  if(samples<VALUE_POLICY.minCalibrationSamples)redFlags.push({level:'BLOCK',code:'CALIBRATION_SAMPLE'}); else if(samples<VALUE_POLICY.minStrongCalibrationSamples)redFlags.push({level:'WARN',code:'STRONG_SAMPLE'})
  if(calStatus==='POOR')redFlags.push({level:'BLOCK',code:'POOR_CALIBRATION'})
  if(modelAgreement<VALUE_POLICY.minModelAgreement)redFlags.push({level:'BLOCK',code:'MODEL_DISAGREEMENT'}); else if(modelAgreement<VALUE_POLICY.minStrongModelAgreement)redFlags.push({level:'WARN',code:'MODEL_AGREEMENT'})
  if(consensusSources>=2&&consensusAgreement<VALUE_POLICY.hardBlockConsensusAgreement)redFlags.push({level:'BLOCK',code:'MARKET_DISAGREEMENT'}); else if(consensusSources>=2&&consensusAgreement<60)redFlags.push({level:'WARN',code:'MARKET_CONSENSUS'})
  if(drift==='DRIFT')redFlags.push({level:'BLOCK',code:'MODEL_DRIFT'}); else if(drift==='WATCH')redFlags.push({level:'WARN',code:'MODEL_DRIFT_WATCH'})
  if(leagueTrust!=null&&leagueTrust<VALUE_POLICY.hardBlockLeagueTrust)redFlags.push({level:'BLOCK',code:'LOW_LEAGUE_TRUST'}); else if(leagueTrust!=null&&leagueTrust<VALUE_POLICY.minStrongLeagueTrust)redFlags.push({level:'WARN',code:'LEAGUE_TRUST'})
  if(priceMoveAgainstPp!=null&&priceMoveAgainstPp<=-8)redFlags.push({level:'BLOCK',code:'PRICE_MOVE_AGAINST'})
  if(edge>=VALUE_POLICY.outlierEdgePp||ev>=VALUE_POLICY.outlierEvPct)redFlags.push({level:'WARN',code:'PRICE_OUTLIER'})
  const blocked=redFlags.some(f=>f.level==='BLOCK')
  let decision='NO_BET'
  if(candidate?.vigAdjusted===false) decision='NO_BET'
  else if(blocked) decision='NO_BET'
  else if(reliabilityScore<VALUE_POLICY.minValueReliability) decision='NO_BET'
  else if(strongPrice&&quality>=VALUE_POLICY.minStrongDataQuality&&reliabilityScore>=VALUE_POLICY.minStrongReliability&&strongSample&&strongAgreement&&strongMarket&&strongLeague) decision='STRONG_VALUE'
  else if(edge>=threshold&&ev>=VALUE_POLICY.minValueEvPct) decision='VALUE'
  else if(edge>0&&ev>0) decision='SMALL_EDGE'
  return {...candidate,threshold,decision,reliabilityScore,reliabilityLabel,redFlags,hardBlocked:blocked}
}
function marketKey(key=''){if(['home','draw','away'].includes(key))return'oneXTwo';if(['over15','under15'].includes(key))return'over15';if(['over25','under25'].includes(key))return'over25';if(['over35','under35'].includes(key))return'over35';if(['bttsYes','bttsNo','btts'].includes(key))return'btts';return key}
function norm(v=''){return String(v||'').toLowerCase().replace(/\s+/g,' ').trim()}
function findBucket(rows=[],p=0){if(!Array.isArray(rows)||p<50)return null;return rows.find(x=>{const m=String(x?.range||'').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);if(!m)return false;const lo=Number(m[1]),hi=Number(m[2]);return p>=lo&&(p<hi||(hi>=100&&p<=hi))})||null}
function calibration(performance=null,league='',candidate=null){
  const key=marketKey(candidate?.key||''), global=performance?.all||null
  const leagueSummary=Array.isArray(performance?.leagues)?performance.leagues.find(x=>norm(x?.name)===norm(league))||null:null
  const find=s=>s?.markets?.find(x=>x?.key===key)||null, gm=find(global), lm=find(leagueSummary), useLeague=Boolean(lm&&n(lm.samples)>=30), market=useLeague?lm:gm
  const samples=n(market?.samples), brier=n(market?.brier), bucket=findBucket(market?.calibration||[],n(candidate?.probability)), gap=n(bucket?.calibrationGap), bucketSamples=n(bucket?.samples)
  let status='PENDING'; if(samples>=30){if(brier>.29||(bucketSamples>=10&&Math.abs(gap)>8))status='POOR';else if(bucketSamples>=10&&Math.abs(gap)<=5)status='GOOD';else status='OK'}
  return {status,samples,brier,source:useLeague?'league':'global',gap:bucket?round1(gap):null,bucketSamples,actualAccuracy:bucket?n(bucket.actualAccuracy):null}
}
function enrichCandidate(scan={},candidate=null,performance=null){
  if(!candidate)return{decision:'NO_ODDS',reliability:{score:0,label:'BRAK KURSÓW',calibration:{status:'PENDING',samples:0}}}
  const cal=calibration(performance,scan?.league||'',candidate), raw=n(candidate?.probability), confidence=raw>=50?raw:100-raw
  const canCal=n(cal.bucketSamples)>=10&&n(cal.actualAccuracy)>0, weight=canCal?Math.max(.18,Math.min(.62,.18+n(cal.bucketSamples)/180+(cal.source==='league'?.08:0))):0
  const calibrated=canCal?confidence*(1-weight)+n(cal.actualAccuracy)*weight:confidence, probability=round1(raw>=50?calibrated:100-calibrated)
  const noVig=n(candidate?.noVigImplied), odds=n(candidate?.bookmakerOdds)
  const c={...candidate,rawProbability:round1(raw),probability,fairOdds:probability>0?Math.round((100/probability)*100)/100:0,edgePp:noVig>0?round1(probability-noVig):n(candidate?.edgePp),expectedValuePct:odds>1?round1((probability/100*odds-1)*100):n(candidate?.expectedValuePct),calibrated:canCal,calibration:cal,vigAdjusted:true}
  const consensus=candidate?.marketConsensus||scan?.marketConsensus?.[candidate?.key]||null, sources=n(consensus?.sources), agreement=n(consensus?.agreement), perfKey=marketKey(candidate?.key||'')
  const driftRow=Array.isArray(performance?.drift?.markets)?performance.drift.markets.find(x=>x?.key===perfKey):null
  const leagueTrust=Array.isArray(performance?.leagueTrust)?performance.leagueTrust.find(x=>norm(x?.name)===norm(scan?.league||''))||null:null
  const leagueMarket=Array.isArray(leagueTrust?.markets)?leagueTrust.markets.find(x=>x?.key===perfKey)||null:null
  const marketScore=sources>=2?agreement:n(scan?.bookmakerCount)>=3?82:n(scan?.bookmakerCount)>=1?70:35
  const priceMoveAgainstPp = candidate?.priceMoveAgainstPp ?? scan?.priceMoveAgainstPp ?? scan?.marketMoveAgainstPp ?? null
  const out=classify(c,{dataQuality:n(scan?.dataQuality),modelAgreement:n(scan?.modelAgreement),marketScore,consensusSources:sources,consensusAgreement:agreement,marketDriftStatus:driftRow?.status||'PENDING',leagueTrustScore:leagueMarket?.score??null,priceMoveAgainstPp})
  const warningPenalty=(out.redFlags||[]).reduce((s,f)=>s+(f.level==='BLOCK'?16:4),0)
  const dailyScore=Math.round(Math.max(0,Math.min(100,out.reliabilityScore*.46+Math.min(22,Math.max(0,n(out.edgePp)))*1.15+Math.min(30,Math.max(0,n(out.expectedValuePct)))*.35+(sources>=2?agreement:marketScore)*.10+n(leagueMarket?.score,65)*.08-warningPenalty)))
  return {...out,marketConsensus:consensus,driftStatus:driftRow?.status||'PENDING',leagueMarketTrust:leagueMarket||null,reliability:{score:out.reliabilityScore,label:out.reliabilityLabel,calibration:cal,modelAgreement:n(scan?.modelAgreement),dataQuality:n(scan?.dataQuality)},dailyScore}
}
function enrichScan(scan={},performance=null){const p={STRONG_VALUE:5,VALUE:4,SMALL_EDGE:3,NO_BET:2,NO_ODDS:1};const rows=(scan?.candidates||[]).map(x=>enrichCandidate(scan,x,performance)).sort((a,b)=>(p[b.decision]||0)-(p[a.decision]||0)||n(b.edgePp)-n(a.edgePp));return{...scan,candidates:rows,topFinal:rows[0]||enrichCandidate(scan,null,performance)}}
module.exports={VALUE_POLICY,classify,enrichCandidate,enrichScan,marketKey}
