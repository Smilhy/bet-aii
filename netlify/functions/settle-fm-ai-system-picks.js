const { createClient } = require('@supabase/supabase-js')
const { apiGet } = require('./_lib/match-simulator-rate-shield')
const { n, settleMarket } = require('./_lib/fm-ai-system-tracker-v368')
const SUPABASE_URL=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||''
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||''
const TABLE='fm_ai_system_picks_v368'
function json(statusCode,body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)}}
exports.handler=async()=>{
  if(!SUPABASE_URL||!SERVICE_KEY)return json(503,{ok:false,error:'Supabase unavailable'})
  const s=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const cutoff=new Date(Date.now()-90*60*1000).toISOString()
  const {data:pending,error}=await s.from(TABLE).select('*').eq('status','pending').lt('fixture_date',cutoff).order('fixture_date',{ascending:true}).limit(250)
  if(error)return json(500,{ok:false,error:error.message})
  if(!pending?.length)return json(200,{ok:true,checked:0,settled:0})
  const byDay=new Map(); for(const p of pending){ const day=String(p.fixture_date||'').slice(0,10); if(!byDay.has(day))byDay.set(day,[]); byDay.get(day).push(p) }
  let settled=0, checked=0
  for(const [day,picks] of byDay){
    const r=await apiGet('/fixtures',{date:day,timezone:'UTC'},{ttlMs:10*60*1000,attempts:2,budgetScope:'fm-ai-system-settlement',budgetLimit:20,totalBudgetLimit:1600})
    if(!r?.ok)continue
    const map=new Map((r.data||[]).map(x=>[String(x?.fixture?.id||''),x]))
    for(const p of picks){
      checked++
      const f=map.get(String(p.fixture_id)); if(!f)continue
      const st=String(f?.fixture?.status?.short||'').toUpperCase()
      if(['CANC','ABD','AWD','WO'].includes(st)){
        await s.from(TABLE).update({status:'void',profit_pln:0,settled_at:new Date().toISOString(),settlement_source:`API_FOOTBALL_${st}`,updated_at:new Date().toISOString()}).eq('id',p.id); settled++; continue
      }
      if(!['FT','AET','PEN'].includes(st))continue
      const h=n(f?.score?.fulltime?.home, n(f?.goals?.home,NaN)); const a=n(f?.score?.fulltime?.away,n(f?.goals?.away,NaN)); if(!Number.isFinite(h)||!Number.isFinite(a))continue
      const won=settleMarket(p.market_key,h,a); if(won==null)continue
      const stake=n(p.stake_pln,10); const odds=n(p.odds,0); const profit=won?stake*(odds-1):-stake
      await s.from(TABLE).update({status:won?'win':'loss',actual_home_goals:h,actual_away_goals:a,profit_pln:Math.round(profit*100)/100,settled_at:new Date().toISOString(),settlement_source:'API_FOOTBALL_FULLTIME',updated_at:new Date().toISOString()}).eq('id',p.id)
      settled++
    }
  }
  return json(200,{ok:true,checked,settled})
}

