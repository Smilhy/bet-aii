const { createClient } = require('@supabase/supabase-js')
const SUPABASE_URL=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||''
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||''
const TABLE='fm_ai_system_picks_v368'
const { n, summary, group } = require('./_lib/fm-ai-system-tracker-v368')
function json(statusCode,body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store, max-age=0'},body:JSON.stringify(body)}}

function marketDetails(rows=[]){
  const m=new Map();for(const r of rows){const key=String(r.market_key||r.market_label||'Inne');if(!m.has(key))m.set(key,[]);m.get(key).push(r)}
  return [...m.entries()].map(([key,items])=>({key,name:String(items[0]?.market_label||key),...summary(items)})).sort((a,b)=>b.picks-a.picks||b.yieldPct-a.yieldPct)
}
function leagueDetails(rows=[]){
  const m=new Map()
  for(const r of rows){const key=String(r.league||'Inne');if(!m.has(key))m.set(key,[]);m.get(key).push(r)}
  return [...m.entries()].map(([name,items])=>{
    const settled=items.filter(r=>['win','loss','void'].includes(String(r.status||'')))
    const recent=[...items].sort((a,b)=>Date.parse(b.fixture_date)-Date.parse(a.fixture_date)).slice(0,40).map(recordRowV376)
    return {name,...summary(items),settledPicks:settled.length,markets:marketDetails(settled),recent}
  }).sort((a,b)=>b.picks-a.picks||b.yieldPct-a.yieldPct)
}

function sampleLabel(graded=0){
  const n=Number(graded||0)
  if(n>=100)return 'STRONG_SAMPLE'
  if(n>=30)return 'VALIDATING'
  if(n>=10)return 'EARLY_SIGNAL'
  return 'LOW_SAMPLE'
}
function leagueMarketSegments(rows=[]){
  const m=new Map()
  for(const r of rows){
    const league=String(r.league||'Inne')
    const key=String(r.market_key||r.market_label||'other')
    const id=`${league}|||${key}`
    if(!m.has(id))m.set(id,[])
    m.get(id).push(r)
  }
  const all=[...m.entries()].map(([id,items])=>{
    const base=summary(items)
    const graded=(base.wins||0)+(base.losses||0)
    return {
      id,
      league:String(items[0]?.league||'Inne'),
      marketKey:String(items[0]?.market_key||items[0]?.market_label||'other'),
      market:String(items[0]?.market_label||items[0]?.market_key||'Inne'),
      graded,
      sampleLabel:sampleLabel(graded),
      ...base
    }
  }).sort((a,b)=>b.graded-a.graded||b.picks-a.picks||b.yieldPct-a.yieldPct)
  const ranked=all.filter(x=>x.graded>=5)
  const top=[...ranked].sort((a,b)=>b.yieldPct-a.yieldPct||b.hitEdgePp-a.hitEdgePp||b.graded-a.graded).slice(0,5)
  const watch=[...ranked].sort((a,b)=>a.yieldPct-b.yieldPct||a.hitEdgePp-b.hitEdgePp||b.graded-a.graded).slice(0,5)
  return {all,top,watch,minRankedSample:5,note:'Ranking segmentów wymaga min. 5 rozliczonych typów; status próbki nadal pokazuje, czy wynik jest statystycznie dojrzały.'}
}

function recordRowV376(r={}){
  return {
    id:r.id,
    fixtureId:r.fixture_id,
    date:r.fixture_date,
    publishedAt:r.published_at,
    home:r.home_team,
    away:r.away_team,
    league:r.league,
    country:r.country,
    market:r.market_label,
    key:r.market_key,
    decision:r.decision,
    odds:n(r.odds),
    probability:n(r.ai_probability),
    fairOdds:n(r.fair_odds),
    edgePp:n(r.edge_pp),
    expectedValuePct:n(r.expected_value_pct),
    reliability:n(r.reliability_score),
    dailyScore:n(r.daily_score),
    stake:n(r.stake_pln),
    status:r.status,
    score:r.actual_home_goals==null?null:`${r.actual_home_goals}:${r.actual_away_goals}`,
    profit:n(r.profit_pln),
    modelVersion:r.model_version,
    settlementSource:r.settlement_source,
    settledAt:r.settled_at,
    frozenPreMatch:Boolean(r.published_at && r.fixture_date && Date.parse(r.published_at) < Date.parse(r.fixture_date))
  }
}
function verifiedIntegrityV376(rows=[]){
  const withClock=rows.filter(r=>r?.published_at&&r?.fixture_date)
  const frozen=withClock.filter(r=>Date.parse(r.published_at)<Date.parse(r.fixture_date)).length
  const lateOrInvalid=Math.max(0,withClock.length-frozen)
  return {
    total:rows.length,
    timestamped:withClock.length,
    frozenPreMatch:frozen,
    lateOrInvalid,
    coveragePct:withClock.length?Number((frozen/withClock.length*100).toFixed(1)):0,
    status:lateOrInvalid===0&&withClock.length>0?'VERIFIED':'CHECK'
  }
}

function londonDayKey(){ try { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const y=parts.find(x=>x.type==='year')?.value,m=parts.find(x=>x.type==='month')?.value,d=parts.find(x=>x.type==='day')?.value; if(y&&m&&d)return `${y}-${m}-${d}` } catch(_){} return new Date().toISOString().slice(0,10) }
exports.handler=async()=>{
  if(!SUPABASE_URL||!SERVICE_KEY)return json(503,{ok:false,available:false,code:'NETLIFY_ENV_MISSING',error:'Brak SUPABASE_URL/VITE_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w Netlify ENV.'})
  let host=''
  try{host=new URL(SUPABASE_URL).host}catch(_){}
  const s=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await s.from(TABLE).select('*').order('fixture_date',{ascending:false}).limit(5000)
  if(error){
    const msg=String(error.message||'')
    const missing=/does not exist|relation .* does not exist/i.test(msg)
    const schemaCache=/schema cache|Could not find the table/i.test(msg)
    return json((missing||schemaCache)?200:500,{ok:false,available:false,setupRequired:missing||schemaCache,code:schemaCache?'SCHEMA_CACHE_WAIT':missing?'TABLE_MISSING':'SUPABASE_QUERY_ERROR',error:msg,projectHost:host})
  }
  const rows=data||[]; const now=Date.now(), day=londonDayKey(), d7=now-7*86400000,d30=now-30*86400000
  const byDay=group(rows,r=>r.day_key).slice(0,30)
  const segmentLab=leagueMarketSegments(rows)
  const integrityV376=verifiedIntegrityV376(rows)
  const recordLogV376=rows.slice(0,250).map(recordRowV376)
  return json(200,{ok:true,available:true,code:'READY',projectHost:host,stakePerPick:10,currency:'PLN',policy:'Pierwszy opublikowany VALUE/STRONG VALUE przed kickoffem. 10 PLN flat. Bez testowych meczów i bez późniejszego przepisywania typu.',trackingMode:'AUTO_24_7_V374',analyticsVersion:'VERIFIED_RECORD_PASSPORT_V376',today:summary(rows.filter(r=>String(r.day_key)===day)),last7:summary(rows.filter(r=>Date.parse(r.fixture_date)>=d7)),last30:summary(rows.filter(r=>Date.parse(r.fixture_date)>=d30)),all:summary(rows),byLeague:group(rows,r=>r.league),leagueDetails:leagueDetails(rows),byMarket:group(rows,r=>r.market_label||r.market_key),byDecision:group(rows,r=>r.decision),byDay,segmentLab,verifiedRecordV376:{integrity:integrityV376,records:recordLogV376},recent:rows.slice(0,50).map(recordRowV376)})
}

exports._test={leagueDetails,marketDetails,leagueMarketSegments,sampleLabel,recordRowV376,verifiedIntegrityV376}
