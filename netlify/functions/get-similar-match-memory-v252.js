const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

function json(statusCode, body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'},body:JSON.stringify(body)}}
function client(){const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'';const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||'';if(!url||!key)return null;try{return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}catch(_){return null}}
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v,a,b){return Math.max(a,Math.min(b,n(v,a)))}
function round(v,d=1){const f=10**d;return Math.round(n(v)*f)/f}
function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function hash(v){return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')}

function rowSignature(row={}){
  const f=row.forecast||{}
  return{
    league:String(row.league||''),
    home:n(f?.oneXTwo?.home),draw:n(f?.oneXTwo?.draw),away:n(f?.oneXTwo?.away),
    over25:n(f?.goals?.over25),btts:n(f?.goals?.btts),
    xgHome:n(f?.contextV260?.adjustedXg?.home ?? f?.xg?.home),xgAway:n(f?.contextV260?.adjustedXg?.away ?? f?.xg?.away),
    dataQuality:n(f?.dataQuality ?? row.data_quality),
    odds:n(f?.professionalLab?.decisionCard?.bookmakerOdds ?? f?.value?.top?.bookmakerOdds)
  }
}
function similarityDistance(a={},b={}){
  const diffs=[
    Math.abs(n(a.home)-n(b.home))/18,
    Math.abs(n(a.draw)-n(b.draw))/14,
    Math.abs(n(a.away)-n(b.away))/18,
    Math.abs(n(a.over25)-n(b.over25))/22,
    Math.abs(n(a.btts)-n(b.btts))/22,
    Math.abs((n(a.xgHome)-n(a.xgAway))-(n(b.xgHome)-n(b.xgAway)))/1.1,
    Math.abs((n(a.xgHome)+n(a.xgAway))-(n(b.xgHome)+n(b.xgAway)))/1.5,
    Math.abs(n(a.dataQuality)-n(b.dataQuality))/35
  ]
  if(n(a.odds)>1&&n(b.odds)>1)diffs.push(Math.abs(n(a.odds)-n(b.odds))/1.5)
  let d=diffs.reduce((s,x)=>s+clamp(x,0,2),0)/Math.max(1,diffs.length)
  if(norm(a.league)&&norm(a.league)===norm(b.league))d*=0.86
  return d
}
function candidate(row,current){
  const sig=rowSignature(row), d=similarityDistance(current,sig), sim=clamp(1-d,0,1)
  const hg=n(row.actual_home_goals,-1),ag=n(row.actual_away_goals,-1)
  if(hg<0||ag<0)return null
  return{fixtureId:String(row.fixture_id||''),similarity:sim,league:String(row.league||''),hg,ag,signature:sig,homeWin:hg>ag,draw:hg===ag,awayWin:hg<ag,over25:hg+ag>=3,btts:hg>0&&ag>0}
}
function aggregate(list=[],current={}){
  if(!list.length)return{matches:0}
  const mean=fn=>list.reduce((s,x)=>s+fn(x),0)/list.length
  const rate=fn=>list.filter(fn).length/list.length*100
  const avgSig={home:mean(x=>x.signature.home),draw:mean(x=>x.signature.draw),away:mean(x=>x.signature.away),over25:mean(x=>x.signature.over25),btts:mean(x=>x.signature.btts)}
  const agreement=Math.abs(n(current.home)-avgSig.home)+Math.abs(n(current.draw)-avgSig.draw)+Math.abs(n(current.away)-avgSig.away)
  return{
    matches:list.length,
    avgSimilarity:round(mean(x=>x.similarity)*100,1),
    homeWinRate:round(rate(x=>x.homeWin),1),drawRate:round(rate(x=>x.draw),1),awayWinRate:round(rate(x=>x.awayWin),1),
    over25Rate:round(rate(x=>x.over25),1),bttsRate:round(rate(x=>x.btts),1),
    avgHomeGoals:round(mean(x=>x.hg),2),avgAwayGoals:round(mean(x=>x.ag),2),
    avgModel: {home:round(avgSig.home,1),draw:round(avgSig.draw,1),away:round(avgSig.away,1),over25:round(avgSig.over25,1),btts:round(avgSig.btts,1)},
    modelAgreementPp:round(agreement/3,1),
    sameLeagueMatches:list.filter(x=>norm(x.league)===norm(current.league)).length
  }
}

exports.handler=async function(event={}){
  if(event.httpMethod==='OPTIONS')return json(204,{})
  if(event.httpMethod!=='POST')return json(405,{ok:false,error:'Method not allowed'})
  let body={};try{body=JSON.parse(event.body||'{}')}catch(_){return json(400,{ok:false,error:'Invalid JSON'})}
  const fixtureId=String(body.fixtureId||'').replace(/[^0-9A-Za-z_-]/g,'').slice(0,100)
  const fixtureDate=body.fixtureDate||new Date().toISOString()
  const current={...(body.signature||{}),league:String(body?.signature?.league||'')}
  if(!fixtureId)return json(400,{ok:false,error:'Brak fixtureId'})
  const supabase=client();if(!supabase)return json(503,{ok:false,error:'Supabase ENV niedostępne'})
  const fingerprint=hash({fixtureId,current})
  try{
    try{
      const {data:cached}=await supabase.from('match_similarity_cache_v252').select('result,expires_at').eq('fingerprint',fingerprint).maybeSingle()
      if(cached?.result&&Date.parse(cached.expires_at||'')>Date.now())return json(200,{ok:true,cached:true,...cached.result})
    }catch(_){}
    const {data,error}=await supabase.from('match_prediction_snapshots')
      .select('fixture_id,fixture_date,league,data_quality,actual_home_goals,actual_away_goals,settled_at,forecast')
      .neq('fixture_id',fixtureId).lt('fixture_date',fixtureDate).not('actual_home_goals','is',null).not('actual_away_goals','is',null)
      .order('fixture_date',{ascending:false}).limit(Math.min(3000,Math.max(500,n(body.limit,120)*20)))
    if(error)throw error
    const rows=data||[]
    const ranked=rows.map(row=>candidate(row,current)).filter(Boolean).filter(x=>x.similarity>=.40).sort((a,b)=>b.similarity-a.similarity)
    const wanted=Math.min(120,Math.max(20,n(body.limit,80)))
    const selected=ranked.slice(0,wanted)
    const summary=aggregate(selected,current)
    const confidence=summary.matches>=70&&summary.avgSimilarity>=72?'HIGH':summary.matches>=35&&summary.avgSimilarity>=62?'MEDIUM':summary.matches>=15?'LOW':'COLLECTING'
    const result={available:summary.matches>=15,searched:rows.length,qualified:ranked.length,confidence,summary,note:summary.matches<15?'Potrzeba minimum 15 podobnych, wcześniej rozliczonych meczów.':`Pamięć używa ${summary.matches} najbliższych historycznych przypadków; ${summary.sameLeagueMatches||0} z tej samej ligi.`}
    try{await supabase.from('match_similarity_cache_v252').upsert({fingerprint,fixture_id:fixtureId,model_version:'BETAI_FORECAST_V260',signature:current,result,expires_at:new Date(Date.now()+12*3600000).toISOString(),updated_at:new Date().toISOString()},{onConflict:'fingerprint'})}catch(_){}
    return json(200,{ok:true,cached:false,...result})
  }catch(error){return json(500,{ok:false,error:error?.message||String(error)})}
}

exports._test={rowSignature,similarityDistance,candidate,aggregate}
