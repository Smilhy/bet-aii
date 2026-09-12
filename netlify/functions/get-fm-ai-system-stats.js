const { createClient } = require('@supabase/supabase-js')
const SUPABASE_URL=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||''
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||''
const TABLE='fm_ai_system_picks_v368'
const { n, summary, group } = require('./_lib/fm-ai-system-tracker-v368')
function json(statusCode,body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'},body:JSON.stringify(body)}}
function londonDayKey(){ try { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const y=parts.find(x=>x.type==='year')?.value,m=parts.find(x=>x.type==='month')?.value,d=parts.find(x=>x.type==='day')?.value; if(y&&m&&d)return `${y}-${m}-${d}` } catch(_){} return new Date().toISOString().slice(0,10) }
exports.handler=async()=>{
  if(!SUPABASE_URL||!SERVICE_KEY)return json(503,{ok:false,available:false,error:'Supabase unavailable'})
  const s=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await s.from(TABLE).select('*').order('fixture_date',{ascending:false}).limit(5000)
  if(error){const missing=/does not exist|schema cache|relation/i.test(error.message||'');return json(missing?200:500,{ok:missing,available:false,setupRequired:missing,error:error.message})}
  const rows=data||[]; const now=Date.now(), day=londonDayKey(), d7=now-7*86400000,d30=now-30*86400000
  const byDay=group(rows,r=>r.day_key).slice(0,30)
  return json(200,{ok:true,available:true,stakePerPick:10,currency:'PLN',policy:'Pierwszy opublikowany VALUE/STRONG VALUE przed kickoffem. 10 PLN flat. Bez testowych meczów i bez późniejszego przepisywania typu.',today:summary(rows.filter(r=>String(r.day_key)===day)),last7:summary(rows.filter(r=>Date.parse(r.fixture_date)>=d7)),last30:summary(rows.filter(r=>Date.parse(r.fixture_date)>=d30)),all:summary(rows),byLeague:group(rows,r=>r.league),byMarket:group(rows,r=>r.market_label||r.market_key),byDecision:group(rows,r=>r.decision),byDay,recent:rows.slice(0,50).map(r=>({id:r.id,fixtureId:r.fixture_id,date:r.fixture_date,home:r.home_team,away:r.away_team,league:r.league,market:r.market_label,key:r.market_key,decision:r.decision,odds:n(r.odds),probability:n(r.ai_probability),status:r.status,score:r.actual_home_goals==null?null:`${r.actual_home_goals}:${r.actual_away_goals}`,profit:n(r.profit_pln)}))})
}

