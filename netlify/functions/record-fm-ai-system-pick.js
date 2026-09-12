const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
const TABLE = 'fm_ai_system_picks_v368'
const SNAP_TABLE = 'match_value_scan_snapshots'

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type, Authorization', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Cache-Control':'no-store' }, body: JSON.stringify(body) }
}
function clean(v=''){ return String(v == null ? '' : v).trim() }
function num(v, d=0){ const n=Number(v); return Number.isFinite(n)?n:d }
function marketKey(v=''){ const s=clean(v).toLowerCase().replace(/[\s_.-]/g,''); const m={home:'home','1':'home',draw:'draw',x:'draw',away:'away','2':'away',over15:'over15',over25:'over25',over35:'over35',under15:'under15',under25:'under25',under35:'under35',bttsyes:'bttsYes',btts:'bttsYes',bttsno:'bttsNo'}; return m[s] || clean(v) }

exports.handler = async (event={}) => {
  if (event.httpMethod === 'OPTIONS') return json(204,{})
  if (event.httpMethod !== 'POST') return json(405,{ok:false,error:'Method not allowed'})
  if (!SUPABASE_URL || !SERVICE_KEY) return json(503,{ok:false,error:'Supabase service unavailable'})
  const s=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  let body={}
  try { body=JSON.parse(event.body||'{}') } catch(_) { return json(400,{ok:false,error:'Invalid JSON'}) }
  const fixtureId=clean(body.fixtureId||body.fixture_id)
  const key=marketKey(body.marketKey||body.market_key)
  const decision=clean(body.decision).toUpperCase()
  if (!fixtureId || !key) return json(400,{ok:false,error:'Missing fixture/market'})
  if (!['VALUE','STRONG_VALUE'].includes(decision)) return json(200,{ok:true,recorded:false,reason:'not_actionable'})

  const {data:snap,error:snapError}=await s.from(SNAP_TABLE).select('fixture_id,fixture_date,home_team,away_team,league,country,payload').eq('fixture_id',fixtureId).maybeSingle()
  if (snapError || !snap?.payload) return json(409,{ok:false,error:'No frozen pre-match scanner snapshot'})
  const kickoff=Date.parse(snap.fixture_date||snap.payload?.fixtureDate||'')
  if (!Number.isFinite(kickoff) || Date.now() >= kickoff) return json(409,{ok:false,error:'Pick cannot be created after kickoff'})
  const serverCandidate=(snap.payload?.candidates||[]).find(c=>marketKey(c?.key)===key)
  if (!serverCandidate) return json(409,{ok:false,error:'Market not present in server scanner snapshot'})
  const serverOdds=num(serverCandidate.bookmakerOdds)
  if (!(serverOdds>1)) return json(409,{ok:false,error:'No real bookmaker odds'})
  const sentOdds=num(body.odds)
  if (sentOdds>1 && Math.abs(sentOdds-serverOdds)>.20) return json(409,{ok:false,error:'Odds do not match scanner snapshot'})
  if (!(num(serverCandidate.edgePp)>0) || !(num(serverCandidate.expectedValuePct)>0)) return json(409,{ok:false,error:'Server snapshot has no positive edge'})
  if (num(snap.payload?.dataQuality)<70 || num(snap.payload?.modelAgreement)<40) return json(409,{ok:false,error:'Server snapshot quality below tracker guard'})

  const fixtureDate=snap.fixture_date||snap.payload?.fixtureDate
  const row={
    fixture_id:fixtureId,
    fixture_date:fixtureDate,
    day_key:/^\d{4}-\d{2}-\d{2}$/.test(clean(body.dayKey||body.day_key)) ? clean(body.dayKey||body.day_key) : String(fixtureDate).slice(0,10),
    home_team:clean(snap.home_team||snap.payload?.home), away_team:clean(snap.away_team||snap.payload?.away),
    league:clean(snap.league||snap.payload?.league), country:clean(snap.country||snap.payload?.country),
    market_key:key, market_label:clean(body.marketLabel||body.market_label||key), decision,
    odds:serverOdds,
    ai_probability:num(body.aiProbability||body.ai_probability||serverCandidate.probability,null),
    fair_odds:num(body.fairOdds||body.fair_odds||serverCandidate.fairOdds,null),
    edge_pp:num(body.edgePp||body.edge_pp||serverCandidate.edgePp,null),
    expected_value_pct:num(body.expectedValuePct||body.expected_value_pct||serverCandidate.expectedValuePct,null),
    reliability_score:num(body.reliabilityScore||body.reliability_score,null),
    daily_score:num(body.dailyScore||body.daily_score,null),
    stake_pln:10,
    model_version:'V368',
    last_seen_at:new Date().toISOString(),
    display_snapshot:{ probability:num(body.aiProbability||serverCandidate.probability), rawProbability:num(serverCandidate.probability), odds:serverOdds, decision, reliability:num(body.reliabilityScore), dailyScore:num(body.dailyScore), recordedFrom:'FM_AI_DAILY_UI_V368' }
  }

  const {data:existing}=await s.from(TABLE).select('id,fixture_id,market_key,decision,published_at').eq('fixture_id',fixtureId).maybeSingle()
  if (existing) {
    await s.from(TABLE).update({last_seen_at:new Date().toISOString()}).eq('id',existing.id)
    return json(200,{ok:true,recorded:false,duplicate:true,frozen:existing})
  }
  const {data,error}=await s.from(TABLE).insert(row).select('id,fixture_id,market_key,decision,odds,published_at').single()
  if (error) return json(500,{ok:false,error:error.message})
  return json(200,{ok:true,recorded:true,pick:data})
}
