const { createClient } = require('@supabase/supabase-js')
function json(statusCode, body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)}}
function client(){const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'';const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||'';if(!url||!key)return null;try{return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}catch(_){return null}}
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v,a,b){return Math.max(a,Math.min(b,n(v,a)))}
function decision(row={}){return String(row?.forecast?.professionalLab?.decisionCard?.decision||row?.forecast?.value?.state||'').toUpperCase()}
function card(row={}){return row?.forecast?.professionalLab?.decisionCard||{}}
function matchName(row={}){return `${String(row.home_team||'').trim()} – ${String(row.away_team||'').trim()}`.trim()}

exports.handler=async function(event={}){
  if(event.httpMethod==='OPTIONS')return json(204,{})
  const supabase=client();if(!supabase)return json(503,{ok:false,error:'Supabase ENV niedostępne'})
  const now=new Date();const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString();const end=new Date(Date.parse(start)+86400000).toISOString();const since24=new Date(Date.now()-86400000).toISOString()
  try{
    const [simQ,predQ,regQ,anomQ,apiQ,freezeQ,opsQ]=await Promise.all([
      supabase.from('match_simulator_snapshots').select('fixture_id,eligible,quality_score,fixture_date').gte('fixture_date',start).lt('fixture_date',end).limit(3000),
      supabase.from('match_prediction_snapshots').select('fixture_id,fixture_date,home_team,away_team,league,data_quality,model_version,forecast').gte('fixture_date',start).lt('fixture_date',end).limit(3000),
      supabase.from('match_model_registry').select('active_version,status,updated_at').eq('registry_key','football-main').maybeSingle(),
      supabase.from('match_data_anomalies').select('severity,anomaly_type,status,last_seen_at').eq('status','open').gte('last_seen_at',new Date(Date.now()-7*86400000).toISOString()).limit(1000),
      supabase.from('match_api_health_events').select('event_type,created_at').gte('created_at',since24).limit(2000),
      supabase.from('match_prediction_freeze_ledger').select('*',{count:'exact',head:true}),
      supabase.from('match_ops_runs').select('run_type,status,started_at').order('started_at',{ascending:false}).limit(80)
    ])
    const sims=simQ.data||[], preds=predQ.data||[], anomalies=anomQ.data||[], api=apiQ.data||[], ops=opsQ.data||[]
    const bets=preds.filter(r=>decision(r)==='BET'), watches=preds.filter(r=>decision(r)==='WATCH'), noBets=preds.filter(r=>['NO_BET','NO BET'].includes(decision(r))||r?.forecast?.reliabilityV190?.abstention?.abstain)
    const rankedConfidence=preds.map(r=>({match:matchName(r),probability:n(card(r)?.conservativeProbability||card(r)?.calibratedProbability||r?.forecast?.value?.top?.probability),row:r})).filter(x=>x.probability>0).sort((a,b)=>b.probability-a.probability)
    const rankedEdge=preds.map(r=>({match:matchName(r),edgePp:n(card(r)?.conservativeEdgePp||r?.forecast?.value?.top?.edgePp),row:r})).filter(x=>x.edgePp!==0).sort((a,b)=>b.edgePp-a.edgePp)
    const riskRows=preds.map(r=>({match:matchName(r),shock:String(r?.forecast?.contextV260?.shock?.level||'NONE'),abstain:Boolean(r?.forecast?.reliabilityV190?.abstention?.abstain),stability:n(r?.forecast?.reliabilityV190?.stability?.score,100)}))
    const highRisk=riskRows.find(x=>x.abstain||x.shock==='HIGH'||x.stability<45)
    const criticalAnomalies=anomalies.filter(x=>x.severity==='critical').length, warnings=anomalies.filter(x=>x.severity==='warning').length
    const apiErrors=api.filter(x=>['RATE_LIMIT','HTTP_ERROR','TIMEOUT','BUDGET_BLOCK'].includes(x.event_type)).length
    const latestByType={};for(const r of ops)if(!latestByType[r.run_type])latestByType[r.run_type]=r
    const eligible=sims.filter(x=>x.eligible).length
    const integrityScore=Math.round(clamp(100-criticalAnomalies*12-warnings*2,0,100))
    let readiness=35
    if(preds.length>=5)readiness+=10;if(preds.length>=20)readiness+=10;if((freezeQ.count||0)>=100)readiness+=10;if(integrityScore>=90)readiness+=15;if(apiErrors===0)readiness+=10
    if(String(regQ.data?.status||'').toUpperCase().includes('ACTIVE')||String(regQ.data?.status||'').toUpperCase().includes('HEALTH'))readiness+=5
    readiness=Math.round(clamp(readiness,0,100))
    const health=criticalAnomalies>0||apiErrors>=8?'CRITICAL':warnings>=5||apiErrors>=3?'WATCH':'HEALTHY'
    const result={
      version:'BETAI_AI_COMMAND_CENTER_V260',health,timeBasis:'UTC_DAY',range:{start,end},
      today:{fixturesTracked:sims.length,eligible,analysed:preds.length,bet:bets.length,watch:watches.length,noBet:noBets.length,topConfidence:rankedConfidence[0]?{match:rankedConfidence[0].match,probability:rankedConfidence[0].probability}:null,topEdge:rankedEdge[0]?{match:rankedEdge[0].match,edgePp:rankedEdge[0].edgePp}:null,risk:highRisk?{label:'HIGH',reason:`${highRisk.match}: ${highRisk.abstain?'abstention':highRisk.shock==='HIGH'?'context shock':'low stability'}`}:{label:'LOW',reason:'brak krytycznego sygnału w dzisiejszych prognozach'}},
      model:{activeVersion:regQ.data?.active_version||'BETAI_CHAMPION_V158_CORE',status:regQ.data?.status||'COLLECTING',updatedAt:regQ.data?.updated_at||null},
      integrity:{score:integrityScore,openAnomalies:anomalies.length,critical:criticalAnomalies,warnings,freezeCount:freezeQ.count||0},
      api:{events24h:api.length,errors24h:apiErrors},
      operations:{settlement:latestByType.settlement||null,odds:latestByType.odds_snapshot||null,rebuild:latestByType.model_rebuild||null,anomaly:latestByType.anomaly_scan||null},
      readiness:{score:readiness,label:readiness>=85?'PRODUCTION STRONG':readiness>=70?'GOOD':readiness>=55?'BUILDING':'EARLY DATA'}
    }
    try{await supabase.from('match_command_center_daily_v260').upsert({summary_date:start.slice(0,10),summary:result,updated_at:new Date().toISOString()},{onConflict:'summary_date'})}catch(_){}
    return json(200,{ok:true,...result})
  }catch(error){return json(500,{ok:false,error:error?.message||String(error)})}
}
