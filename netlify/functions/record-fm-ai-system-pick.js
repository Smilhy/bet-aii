const { createClient } = require('@supabase/supabase-js')
const performanceFn = require('./get-match-prediction-performance')
const { enrichScan } = require('./_lib/fm-ai-value-policy-v374')

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
function parseResponse(r){ try{return JSON.parse(r?.body||'{}')}catch(_){return{}} }
function marketLabel(key='',home='',away=''){
  const map={home:`Wygra ${home||'gospodarz'}`,draw:'Remis',away:`Wygra ${away||'gość'}`,over15:'Powyżej 1.5 gola',under15:'Poniżej 1.5 gola',over25:'Powyżej 2.5 gola',under25:'Poniżej 2.5 gola',over35:'Powyżej 3.5 gola',under35:'Poniżej 3.5 gola',bttsYes:'Obie drużyny strzelą',bttsNo:'Obie drużyny nie strzelą'}
  return map[key]||key
}
const FROZEN_SELECT_V404='id,fixture_id,fixture_date,market_key,market_label,decision,odds,ai_probability,fair_odds,edge_pp,expected_value_pct,reliability_score,daily_score,published_at,display_snapshot'
function frozenClientRowV404(r={}){
  return {
    id:r.id,
    fixtureId:String(r.fixture_id||''),
    date:r.fixture_date||null,
    publishedAt:r.published_at||'',
    key:marketKey(r.market_key||''),
    market:r.market_label||r.market_key||'',
    decision:clean(r.decision).toUpperCase(),
    odds:num(r.odds),
    probability:num(r.ai_probability),
    fairOdds:num(r.fair_odds),
    edgePp:num(r.edge_pp),
    expectedValuePct:num(r.expected_value_pct),
    reliability:num(r.reliability_score),
    dailyScore:num(r.daily_score),
    bookmaker:clean(r?.display_snapshot?.bookmaker||''),
    noVigImplied:r?.display_snapshot?.noVigImplied==null?null:num(r.display_snapshot.noVigImplied),
    rawImplied:r?.display_snapshot?.rawImplied==null?null:num(r.display_snapshot.rawImplied),
    bookmakerMargin:r?.display_snapshot?.bookmakerMargin==null?null:num(r.display_snapshot.bookmakerMargin),
    threshold:r?.display_snapshot?.threshold==null?null:num(r.display_snapshot.threshold),
    marketGroup:clean(r?.display_snapshot?.marketGroup||'')
  }
}
async function loadPerformanceV403(){
  try{
    const r=await performanceFn.handler({httpMethod:'GET',queryStringParameters:{limit:'5000',source:'value_scanner',model_version:'BETAI_VALUE_SCANNER_V1',pre_match_only:'1'}})
    const payload=parseResponse(r)
    return r?.statusCode===200&&payload?.available?payload:null
  }catch(_){return null}
}

exports.handler = async (event={}) => {
  if (event.httpMethod === 'OPTIONS') return json(204,{})
  if (event.httpMethod !== 'POST') return json(405,{ok:false,error:'Method not allowed'})
  if (!SUPABASE_URL || !SERVICE_KEY) return json(503,{ok:false,error:'Supabase service unavailable'})
  const s=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  let body={}
  try { body=JSON.parse(event.body||'{}') } catch(_) { return json(400,{ok:false,error:'Invalid JSON'}) }
  const fixtureId=clean(body.fixtureId||body.fixture_id)
  const requestedKey=marketKey(body.marketKey||body.market_key)
  const requestedDecision=clean(body.decision).toUpperCase()
  if (!fixtureId) return json(400,{ok:false,error:'Missing fixture'})

  // V404: direct canonical recovery happens BEFORE validating the current UI
  // market/decision. This makes the server record the final authority even if
  // the current rescan has already drifted to NO_BET, lost its market, or the
  // broad stats endpoint is temporarily stale/unavailable.
  const {data:existing,error:existingError}=await s.from(TABLE).select(FROZEN_SELECT_V404).eq('fixture_id',fixtureId).maybeSingle()
  if (existingError) return json(500,{ok:false,error:existingError.message||'Canonical lookup failed',code:existingError.code||''})
  if (existing) {
    await s.from(TABLE).update({last_seen_at:new Date().toISOString()}).eq('id',existing.id)
    return json(200,{ok:true,recorded:false,duplicate:true,frozen:existing,canonicalFrozenV404:frozenClientRowV404(existing),firstPublishedWinsV403:true,directRecoveryV404:true})
  }

  // V404: do not trust the browser's current market/decision as a gate. The
  // frozen scanner snapshot + server VALUE policy decide whether a pick exists.

  const {data:snap,error:snapError}=await s.from(SNAP_TABLE).select('fixture_id,fixture_date,home_team,away_team,league,country,payload').eq('fixture_id',fixtureId).maybeSingle()
  if (snapError || !snap?.payload) return json(409,{ok:false,error:'No frozen pre-match scanner snapshot'})
  const kickoff=Date.parse(snap.fixture_date||snap.payload?.fixtureDate||'')
  if (!Number.isFinite(kickoff) || Date.now() >= kickoff) return json(409,{ok:false,error:'Pick cannot be created after kickoff'})

  // V403: the server re-runs the same VALUE policy and chooses the canonical
  // topFinal itself. The browser may request a stale/different market, but it
  // can no longer decide which market/decision/economics become frozen.
  const performanceV403=await loadPerformanceV403()
  const enrichedV403=enrichScan(snap.payload,performanceV403)
  const serverCandidate=enrichedV403?.topFinal||null
  const key=marketKey(serverCandidate?.key||'')
  const decision=clean(serverCandidate?.decision).toUpperCase()
  if (!serverCandidate || !key) return json(409,{ok:false,error:'Server policy did not produce a canonical market'})
  if (!['VALUE','STRONG_VALUE'].includes(decision)) return json(200,{ok:true,recorded:false,reason:'not_actionable',serverDecision:decision||'NO_BET',requestedKey,serverKey:key,serverAuthorityV404:true})
  const serverOdds=num(serverCandidate.bookmakerOdds)
  if (!(serverOdds>1)) return json(409,{ok:false,error:'No real bookmaker odds'})
  const sentOdds=num(body.odds)
  // A stale UI is allowed to lose the race to the canonical server top; the
  // read-back step will adopt the server record. We only compare odds when the
  // client happened to request the same market.
  if (requestedKey===key && sentOdds>1 && Math.abs(sentOdds-serverOdds)>.20) return json(409,{ok:false,error:'Odds do not match canonical server snapshot'})
  if (!(num(serverCandidate.edgePp)>0) || !(num(serverCandidate.expectedValuePct)>0)) return json(409,{ok:false,error:'Canonical server pick has no positive edge'})
  if (num(snap.payload?.dataQuality)<70 || num(snap.payload?.modelAgreement)<40) return json(409,{ok:false,error:'Server snapshot quality below tracker guard'})

  const fixtureDate=snap.fixture_date||snap.payload?.fixtureDate
  const row={
    fixture_id:fixtureId,
    fixture_date:fixtureDate,
    day_key:/^\d{4}-\d{2}-\d{2}$/.test(clean(body.dayKey||body.day_key)) ? clean(body.dayKey||body.day_key) : String(fixtureDate).slice(0,10),
    home_team:clean(snap.home_team||snap.payload?.home), away_team:clean(snap.away_team||snap.payload?.away),
    league:clean(snap.league||snap.payload?.league), country:clean(snap.country||snap.payload?.country),
    market_key:key, market_label:marketLabel(key,clean(snap.home_team||snap.payload?.home),clean(snap.away_team||snap.payload?.away)), decision,
    odds:serverOdds,
    ai_probability:num(serverCandidate.probability,null),
    fair_odds:num(serverCandidate.fairOdds,null),
    edge_pp:num(serverCandidate.edgePp,null),
    expected_value_pct:num(serverCandidate.expectedValuePct,null),
    reliability_score:num(serverCandidate?.reliability?.score ?? serverCandidate?.reliabilityScore,null),
    daily_score:num(serverCandidate.dailyScore,null),
    stake_pln:10,
    model_version:'V368',
    last_seen_at:new Date().toISOString(),
    display_snapshot:{
      probability:num(serverCandidate.probability), rawProbability:num(serverCandidate.rawProbability ?? serverCandidate.probability), odds:serverOdds, decision,
      reliability:num(serverCandidate?.reliability?.score ?? serverCandidate?.reliabilityScore), dailyScore:num(serverCandidate.dailyScore), recordedFrom:clean(body.recordedFrom||body.recorded_from||'FM_AI_DAILY_UI_V368'),
      bookmaker:clean(serverCandidate.bookmaker||''), fairOdds:num(serverCandidate.fairOdds), rawImplied:serverCandidate.rawImplied==null?null:num(serverCandidate.rawImplied),
      noVigImplied:serverCandidate.noVigImplied==null?null:num(serverCandidate.noVigImplied), bookmakerMargin:serverCandidate.bookmakerMargin==null?null:num(serverCandidate.bookmakerMargin),
      threshold:serverCandidate.threshold==null?null:num(serverCandidate.threshold), marketGroup:clean(serverCandidate.marketGroup||''),
      serverCandidateDecision:decision, canonicalMarketKey:key, requestedMarketKey:requestedKey, requestedDecision, serverAuthoritativeV403:true, performanceLoadedV403:Boolean(performanceV403)
    }
  }

  const {data,error}=await s.from(TABLE).insert(row).select(FROZEN_SELECT_V404).single()
  if (error) {
    // V402: UI recorder and scheduled auto-tracker can hit the same fixture at
    // nearly the same moment. The UNIQUE(fixture_id) constraint is the final
    // authority; a race must resolve as a duplicate, never as a false 500.
    if (String(error.code||'') === '23505') {
      const {data:frozen}=await s.from(TABLE).select(FROZEN_SELECT_V404).eq('fixture_id',fixtureId).maybeSingle()
      if (frozen) return json(200,{ok:true,recorded:false,duplicate:true,raceResolvedV402:true,frozen,canonicalFrozenV404:frozenClientRowV404(frozen),directRecoveryV404:true})
    }
    return json(500,{ok:false,error:error.message,code:error.code||''})
  }
  return json(200,{ok:true,recorded:true,pick:data,canonicalFrozenV404:frozenClientRowV404(data),serverAuthorityV404:true})
}
