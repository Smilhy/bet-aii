const { createClient } = require('@supabase/supabase-js')
const sportsEvents = require('../get-sports-events')
const valueScan = require('../get-match-value-scan')
const performanceFn = require('../get-match-prediction-performance')
const recordPick = require('../record-fm-ai-system-pick')
const { enrichScan } = require('./fm-ai-value-policy-v374')

const SUPABASE_URL=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||''
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||''
const TRACKER='fm_ai_system_picks_v368'
const SNAP='match_value_scan_snapshots'

function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function parseResponse(r){try{return JSON.parse(r?.body||'{}')}catch(_){return{}}}
function londonDayKey(date=new Date()){
  try{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);return `${p.find(x=>x.type==='year')?.value}-${p.find(x=>x.type==='month')?.value}-${p.find(x=>x.type==='day')?.value}`}catch(_){return date.toISOString().slice(0,10)}
}
function marketLabel(key='',home='',away=''){
  const map={home:`Wygra ${home||'gospodarz'}`,draw:'Remis',away:`Wygra ${away||'gość'}`,over15:'Powyżej 1.5 gola',under15:'Poniżej 1.5 gola',over25:'Powyżej 2.5 gola',under25:'Poniżej 2.5 gola',over35:'Powyżej 3.5 gola',under35:'Poniżej 3.5 gola',bttsYes:'Obie drużyny strzelą',bttsNo:'Obie drużyny nie strzelą'}
  return map[key]||key
}
function freshnessMs(kickoffMs){const lead=(kickoffMs-Date.now())/60000;if(lead<=60)return 14*60000;if(lead<=180)return 34*60000;if(lead<=480)return 74*60000;return 179*60000}
function fixtureId(f={}){return String(f.apiFixtureId||f.id||'')}
function teamId(f={},side='home'){return String(side==='home'?(f.homeTeamId||f?.teams?.home?.id||''):(f.awayTeamId||f?.teams?.away?.id||''))}
function kickoffIso(f={}){return f.commence_time||f.fixture_date||f.date||null}

async function loadPerformance(){
  try{
    const r=await performanceFn.handler({httpMethod:'GET',queryStringParameters:{limit:'5000',source:'value_scanner',model_version:'BETAI_VALUE_SCANNER_V1',pre_match_only:'1'}})
    const p=parseResponse(r);return r?.statusCode===200&&p?.available?p:null
  }catch(_){return null}
}
async function loadFixtures(day){
  const r=await sportsEvents.handler({httpMethod:'GET',queryStringParameters:{sport:'Piłka nożna',mode:'today',date:day,days:'0',topOnly:'1',skipOdds:'1',realOnly:'1',timezone:'Europe/London',maxTopFixtures:'200'}})
  const p=parseResponse(r)
  if(r?.statusCode!==200||!p?.ok)throw new Error(p?.message||p?.error||'Could not load FM AI fixtures')
  return Array.isArray(p.fixtures)?p.fixtures:[]
}
async function loadState(s,fixtures){
  const ids=fixtures.map(fixtureId).filter(Boolean)
  if(!ids.length)return{tracked:new Set(),snaps:new Map()}
  const tracked=new Set(),snaps=new Map()
  for(let i=0;i<ids.length;i+=100){
    const chunk=ids.slice(i,i+100)
    const [{data:t},{data:ss}]=await Promise.all([
      s.from(TRACKER).select('fixture_id').in('fixture_id',chunk),
      s.from(SNAP).select('fixture_id,fixture_date,updated_at,payload').in('fixture_id',chunk)
    ])
    for(const row of t||[])tracked.add(String(row.fixture_id))
    for(const row of ss||[])snaps.set(String(row.fixture_id),row)
  }
  return{tracked,snaps}
}
async function scanFixture(f,snapshot,performance){
  const id=fixtureId(f),kick=kickoffIso(f),kickMs=Date.parse(kick||'')
  if(!id||!Number.isFinite(kickMs)||kickMs<=Date.now()+4*60000)return{status:'skip',reason:'too_late'}
  let raw=snapshot?.payload||null
  const updated=Date.parse(snapshot?.updated_at||'')
  if(!raw||!Number.isFinite(updated)||Date.now()-updated>freshnessMs(kickMs)){
    const homeId=teamId(f,'home'),awayId=teamId(f,'away')
    if(!homeId||!awayId)return{status:'skip',reason:'missing_team_ids'}
    const r=await valueScan.handler({httpMethod:'GET',queryStringParameters:{fixture:id,home_team_id:homeId,away_team_id:awayId,fixture_date:kick,home:String(f.home||''),away:String(f.away||''),league:String(f.league||''),country:String(f.country||'')}})
    const p=parseResponse(r)
    if(r?.statusCode!==200||!p?.ok)return{status:'scan_error',reason:p?.error||`HTTP_${r?.statusCode}`}
    raw=p
  }
  const enriched=enrichScan(raw,performance)
  const top=enriched?.topFinal||{}
  const decision=String(top.decision||'').toUpperCase()
  if(!['VALUE','STRONG_VALUE'].includes(decision))return{status:'no_pick',decision,key:top.key||'',edge:n(top.edgePp)}
  const record=await recordPick.handler({httpMethod:'POST',body:JSON.stringify({
    fixtureId:id,dayKey:londonDayKey(new Date(kick)),marketKey:top.key,marketLabel:marketLabel(top.key,f.home,f.away),decision,
    odds:top.bookmakerOdds,aiProbability:top.probability,fairOdds:top.fairOdds,edgePp:top.edgePp,expectedValuePct:top.expectedValuePct,
    reliabilityScore:top.reliability?.score||top.reliabilityScore,dailyScore:top.dailyScore,recordedFrom:'FM_AI_AUTO_TRACKER_V374'
  })})
  const rp=parseResponse(record)
  if(record?.statusCode===200&&rp?.ok){
    const canonicalRowV403 = rp?.pick || rp?.frozen || null
    return{status:rp.recorded?'recorded':'duplicate',decision:String(canonicalRowV403?.decision||decision),key:String(canonicalRowV403?.market_key||top.key),odds:n(canonicalRowV403?.odds,top.bookmakerOdds)}
  }
  return{status:'record_error',reason:rp?.error||`HTTP_${record?.statusCode}`}
}

async function runFmAiAutoTrackerV374({maxRuntimeMs=780000,maxFixtures=200,concurrency=2}={}){
  if(!SUPABASE_URL||!SERVICE_KEY)throw new Error('Supabase ENV missing')
  const s=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const day=londonDayKey(),started=Date.now(),fixtures=(await loadFixtures(day)).filter(f=>Date.parse(kickoffIso(f)||'')>Date.now()+4*60000).sort((a,b)=>Date.parse(kickoffIso(a)||'')-Date.parse(kickoffIso(b)||'')).slice(0,maxFixtures)
  const performance=await loadPerformance(),state=await loadState(s,fixtures)
  const queue=fixtures.filter(f=>!state.tracked.has(fixtureId(f)))
  const counts={fixtures:fixtures.length,alreadyTracked:fixtures.length-queue.length,processed:0,recorded:0,duplicate:0,noPick:0,skipped:0,errors:0}
  const results=[];let cursor=0
  async function worker(){
    while(cursor<queue.length&&Date.now()-started<maxRuntimeMs){
      const f=queue[cursor++],id=fixtureId(f)
      try{
        const res=await scanFixture(f,state.snaps.get(id),performance);counts.processed++;results.push({fixtureId:id,home:f.home,away:f.away,...res})
        if(res.status==='recorded')counts.recorded++;else if(res.status==='duplicate')counts.duplicate++;else if(res.status==='no_pick')counts.noPick++;else if(res.status==='skip')counts.skipped++;else counts.errors++
      }catch(error){counts.processed++;counts.errors++;results.push({fixtureId:id,status:'error',reason:String(error?.message||error)})}
    }
  }
  await Promise.all(Array.from({length:Math.max(1,Math.min(4,n(concurrency,2)))},worker))
  return{ok:true,version:'V374',day,generatedAt:new Date().toISOString(),runtimeMs:Date.now()-started,timedOut:cursor<queue.length,performanceLoaded:Boolean(performance),...counts,remaining:Math.max(0,queue.length-cursor),results:results.slice(-60)}
}
module.exports={runFmAiAutoTrackerV374,londonDayKey,marketLabel,freshnessMs}
