'use strict'
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const { apiGet } = require('./_lib/match-simulator-rate-shield')
const { logRun } = require('./_lib/match-ops-v211')
const { safe, num, norm, normalizeApiLineups, normalizeApiInjuries, buildPreMatchStateV280, haversineKm } = require('./_lib/prematch-v280')
const { WINDOWS, dueWindow, relevantEventRules } = require('./_lib/prematch-schedule-v280')
const { shouldSkipAutoJobV300 } = require('./_lib/system-safe-mode-v300')
function json(statusCode, body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)}}
function client(){const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'';const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||'';if(!url||!key)return null;try{return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}catch(_){return null}}
function sha(v=''){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function syntheticLineup(players=[], formation=''){return{available:Array.isArray(players)&&players.length>=8,official:false,predicted:true,formation:safe(formation),startXI:(players||[]).slice(0,11).map(p=>({id:safe(p?.id),name:safe(p?.name),pos:safe(p?.pos),grid:safe(p?.grid)}))}}

async function geo(supabase, queryText=''){
  const q=safe(queryText); if(!q)return null; const key=norm(q).replace(/\s+/g,'-').slice(0,180); if(!key)return null
  try{const {data}=await supabase.from('match_geo_cache_v280').select('*').eq('location_key',key).maybeSingle(); if(data?.status==='ok'&&Number.isFinite(Number(data.latitude))&&Number.isFinite(Number(data.longitude)))return{lat:Number(data.latitude),lon:Number(data.longitude),city:q,cached:true}}
  catch(_){}
  try{
    const u=new URL('https://geocoding-api.open-meteo.com/v1/search');u.searchParams.set('name',q);u.searchParams.set('count','1');u.searchParams.set('language','en');u.searchParams.set('format','json')
    const r=await fetch(u,{headers:{'User-Agent':'BetAI/280'}});const p=await r.json().catch(()=>({}));const row=p?.results?.[0]
    if(!r.ok||!row){try{await supabase.from('match_geo_cache_v280').upsert({location_key:key,query_text:q,status:'not_found',updated_at:new Date().toISOString()},{onConflict:'location_key'})}catch(_){};return null}
    const out={lat:Number(row.latitude),lon:Number(row.longitude),city:safe(row.name,q),country:safe(row.country),region:safe(row.admin1)}
    try{await supabase.from('match_geo_cache_v280').upsert({location_key:key,query_text:q,latitude:out.lat,longitude:out.lon,country:out.country||null,region:out.region||null,status:'ok',updated_at:new Date().toISOString()},{onConflict:'location_key'})}catch(_){}
    return out
  }catch(_){return null}
}

async function weatherAtKickoff(location, kickoff){
  if(!location||!Number.isFinite(Number(location.lat))||!Number.isFinite(Number(location.lon)))return{available:false,reason:'location_unknown'}
  try{
    const u=new URL('https://api.open-meteo.com/v1/forecast');u.searchParams.set('latitude',String(location.lat));u.searchParams.set('longitude',String(location.lon));u.searchParams.set('hourly','temperature_2m,precipitation,wind_speed_10m');u.searchParams.set('timezone','UTC');u.searchParams.set('forecast_days','2')
    const r=await fetch(u,{headers:{'User-Agent':'BetAI/280'}});const p=await r.json().catch(()=>({}));if(!r.ok)return{available:false,reason:`HTTP ${r.status}`}
    const times=p?.hourly?.time||[];const target=Date.parse(kickoff||'');let best=-1,delta=Infinity
    times.forEach((t,i)=>{const d=Math.abs(Date.parse(`${t}Z`)-target);if(Number.isFinite(d)&&d<delta){delta=d;best=i}})
    if(best<0)return{available:false,reason:'forecast_hour_missing'}
    return{available:true,source:'Open-Meteo',latitude:location.lat,longitude:location.lon,temperatureC:num(p?.hourly?.temperature_2m?.[best]),precipMm:num(p?.hourly?.precipitation?.[best]),windKph:num(p?.hourly?.wind_speed_10m?.[best]),forecastTime:times[best],fetchedAt:new Date().toISOString()}
  }catch(e){return{available:false,reason:e?.message||'weather_error'}}
}

async function fanoutAlerts(supabase, fixture, events=[]){
  if(!events.length)return 0
  const {data:watch}=await supabase.from('match_user_watchlist_v280').select('user_id,rules').eq('fixture_id',String(fixture.id)).eq('enabled',true)
  let count=0
  for(const w of watch||[]){
    const rules=w?.rules||{}
    for(const e of events){
      if(!relevantEventRules(e,rules))continue
      const type=safe(e.event_type); const severity=safe(e.severity,'info')
      const title=type==='DECISION_CHANGE'?'Zmiana decyzji Bet+AI':type==='LINEUP_CONFIRMED'?'Oficjalny skład potwierdzony':type==='PROBABILITY_DELTA'?'Model zmienił probability':type==='MARKET_MOVE'?'Silny ruch rynku':type==='CONFIDENCE_DROP'?'Spadek confidence':'Ważna zmiana przed meczem'
      const msg=`${safe(fixture.home?.name)} – ${safe(fixture.away?.name)} • ${safe(e.detail?.summary||e.detail?.detail||type)}`.slice(0,500)
      const alertKey=`${w.user_id}|${e.event_key}`
      const {error}=await supabase.from('match_user_alerts_v280').upsert({user_id:w.user_id,fixture_id:String(fixture.id),alert_key:alertKey,alert_type:type,severity,title,message:msg,detail:e.detail||{},created_at:new Date().toISOString()},{onConflict:'user_id,alert_key',ignoreDuplicates:true})
      if(!error)count+=1
    }
  }
  return count
}

async function handlerCore(event={}){
  const started=Date.now(),supabase=client();if(!supabase)return json(503,{ok:false,error:'Supabase ENV niedostępne'});const gateV300=await shouldSkipAutoJobV300(supabase,'prematch_scan');if(gateV300.skip)return json(200,{ok:true,skipped:true,reason:'SYSTEM_SAFE_MODE'})
  try{
    const now=Date.now(),from=new Date(now+4*60000).toISOString(),to=new Date(now+136*60000).toISOString()
    const {data:snaps,error}=await supabase.from('match_prediction_snapshots').select('fixture_id,fixture_date,home_team,away_team,league,forecast,settled_at').is('settled_at',null).gte('fixture_date',from).lte('fixture_date',to).order('fixture_date',{ascending:true}).limit(80)
    if(error)throw error
    const due=(snaps||[]).map(s=>({snap:s,window:dueWindow(s.fixture_date,now)})).filter(x=>x.window)
    if(!due.length){await logRun(supabase,'prematch_scan',started,'skipped',{scanned:(snaps||[]).length,due:0});return json(200,{ok:true,scanned:(snaps||[]).length,due:0,processed:0})}
    const ids=due.map(x=>String(x.snap.fixture_id))
    const {data:checks}=await supabase.from('match_prematch_events_v280').select('fixture_id,event_key').in('fixture_id',ids).like('event_type','CHECK_WINDOW')
    const seen=new Set((checks||[]).map(x=>x.event_key))
    let processed=0,apiCalls=0,alerts=0,skipped=0,errors=[]
    for(const item of due){
      const s=item.snap,w=item.window,fixtureId=String(s.fixture_id),checkKey=`${fixtureId}|CHECK|${w.key}`
      if(seen.has(checkKey)){skipped+=1;continue}
      try{
        const [{data:simRows},{data:priorState},{data:oddsRows}] = await Promise.all([
          supabase.from('match_simulator_snapshots').select('payload,updated_at').eq('fixture_id',fixtureId).limit(1),
          supabase.from('match_prematch_state_v280').select('*').eq('fixture_id',fixtureId).maybeSingle(),
          supabase.from('match_odds_timeline').select('market_key,bookmaker,odds,snapshot_window,captured_at').eq('fixture_id',fixtureId).order('captured_at',{ascending:true}).limit(300)
        ])
        const baselineData=simRows?.[0]?.payload||{}, fixture=baselineData?.fixture||{id:fixtureId,date:s.fixture_date,home:{name:s.home_team},away:{name:s.away_team},league:s.league}
        fixture.id=fixtureId; fixture.date=fixture.date||s.fixture_date
        const homeId=String(fixture?.home?.id||''),awayId=String(fixture?.away?.id||'')
        const needLineupFetch=!priorState?.official_lineups||w.key==='T15'
        const [lineR,injR]=await Promise.all([
          needLineupFetch?apiGet('/fixtures/lineups',{fixture:fixtureId},{budgetScope:'prematch-live-v280',budgetLimit:140,totalBudgetLimit:750,ttlMs:3*60000,allowStaleMs:20*60000,attempts:2,timeoutMs:8000,forceRefresh:true}):Promise.resolve(null),
          ['T90','T30'].includes(w.key)?apiGet('/injuries',{fixture:fixtureId},{budgetScope:'prematch-live-v280',budgetLimit:140,totalBudgetLimit:750,ttlMs:10*60000,allowStaleMs:40*60000,attempts:2,timeoutMs:8000,forceRefresh:true}):Promise.resolve(null)
        ])
        if(!lineR?.fromCache)apiCalls+=lineR?.ok?1:0; if(injR&&!injR?.fromCache)apiCalls+=injR?.ok?1:0
        const normalizedLineups=lineR?.ok?normalizeApiLineups(lineR.data||[],homeId,awayId):{home:{},away:{}}
        const priorCurrent=priorState?.lineup_payload?.current||baselineData?.lineups||{}
        const latestLineups={
          home:(normalizedLineups?.home?.startXI?.length||0)>=11?normalizedLineups.home:(priorCurrent?.home||normalizedLineups.home||{}),
          away:(normalizedLineups?.away?.startXI?.length||0)>=11?normalizedLineups.away:(priorCurrent?.away||normalizedLineups.away||{})
        }
        const latestInjuries=injR?.ok?normalizeApiInjuries(injR.data||[],homeId,awayId):(priorState?.injuries_payload?.current||{home:(baselineData?.injuries?.items||[]).filter(x=>String(x.teamId)===homeId),away:(baselineData?.injuries?.items||[]).filter(x=>String(x.teamId)===awayId)})
        const frozenBaselineLineups=priorState?.lineup_payload?.baseline||null
        const baselineLineups=frozenBaselineLineups||{home:baselineData?.lineups?.home||{},away:baselineData?.lineups?.away||{}}
        const baselineInjuryItems=priorState?.injuries_payload?.baseline||baselineData?.injuries?.items||[]
        const baselineDataForState={...baselineData,injuries:{...(baselineData?.injuries||{}),items:baselineInjuryItems}}

        const venueCity=safe(fixture?.city||baselineData?.fixture?.city)
        let venueLocation=null,weather=priorState?.weather_payload?.raw||null
        if(venueCity){
          venueLocation=await geo(supabase,venueCity)
          if(!weather?.available||Date.now()-Date.parse(weather?.fetchedAt||0)>45*60000)weather=await weatherAtKickoff(venueLocation,fixture.date)
          if(homeId){try{const stamp=new Date().toISOString();await supabase.from('match_team_context_registry_v260').update({home_base_city:venueCity,updated_at:stamp}).eq('team_id',homeId).is('home_base_city',null);if(venueLocation)await supabase.from('match_team_context_registry_v260').update({home_base_lat:venueLocation.lat,home_base_lon:venueLocation.lon,home_base_geocoded_at:stamp,updated_at:stamp}).eq('team_id',homeId).is('home_base_lat',null)}catch(_){}}
        }
        const {data:teamRows}=await supabase.from('match_team_context_registry_v260').select('team_id,home_base_city,home_base_lat,home_base_lon,last_lineup,last_goalkeeper').in('team_id',[homeId,awayId].filter(Boolean))
        const awayBase=(teamRows||[]).find(x=>String(x.team_id)===awayId)||{}
        let awayLoc=Number.isFinite(Number(awayBase.home_base_lat))&&Number.isFinite(Number(awayBase.home_base_lon))?{lat:Number(awayBase.home_base_lat),lon:Number(awayBase.home_base_lon),city:safe(awayBase.home_base_city)}:null
        if(!awayLoc&&awayBase.home_base_city){awayLoc=await geo(supabase,awayBase.home_base_city);if(awayLoc){try{await supabase.from('match_team_context_registry_v260').update({home_base_lat:awayLoc.lat,home_base_lon:awayLoc.lon,home_base_geocoded_at:new Date().toISOString()}).eq('team_id',awayId)}catch(_){}}}
        const travel=venueLocation&&awayLoc?{available:true,distanceKm:haversineKm(awayLoc.lat,awayLoc.lon,venueLocation.lat,venueLocation.lon),from:awayLoc.city||awayBase.home_base_city,to:venueCity,source:'tracked-home-base'}:{available:false,distanceKm:0,reason:'team_base_unknown'}

        const refName=safe(fixture?.referee);let refProfile=null
        if(refName){const {data:r}=await supabase.from('match_referee_profiles_v280').select('*').eq('referee_key',norm(refName)).maybeSingle();refProfile=r||null}
        const state=buildPreMatchStateV280({fixture,baselineForecast:s.forecast||{},baselineData:baselineDataForState,baselineLineups,latestLineups,latestInjuries,weather:weather||{available:false},refereeProfile:refProfile||{},travel,marketTimeline:oddsRows||[],priorState})
        const status=state.reviewRequired?'REVIEW':state.officialLineups?'READY':'TRACKING'
        const nowIso=new Date().toISOString()
        const row={fixture_id:fixtureId,fixture_date:s.fixture_date||fixture.date||null,home_team:s.home_team||safe(fixture?.home?.name),away_team:s.away_team||safe(fixture?.away?.name),league:s.league||safe(fixture?.league),status,official_lineups:state.officialLineups,official_sides:state.officialSides,lineup_payload:{baseline:baselineLineups,current:latestLineups,comparison:state.lineup},injuries_payload:{baseline:baselineInjuryItems,current:latestInjuries,delta:state.injuries},weather_payload:{raw:weather||{},adjusted:state.weather},referee_payload:{profile:refProfile||{},adjusted:state.referee,name:refName},travel_payload:state.travel,market_payload:state.market,rescore:state.rescored,probability_delta:state.probability,confidence_delta:state.confidence,decision_before:state.decision.before,decision_after:state.decision.after,review_required:state.reviewRequired,flags:state.flags,last_window:w.key,last_checked_at:nowIso,updated_at:nowIso}
        await supabase.from('match_prematch_state_v280').upsert(row,{onConflict:'fixture_id'})

        const newEvents=[]
        const pushEvent=async(type,severity,detail,keySuffix='')=>{const ekey=`${fixtureId}|${type}|${keySuffix||sha(JSON.stringify(detail)).slice(0,16)}`;const e={event_key:ekey,fixture_id:fixtureId,event_type:type,severity,source_window:w.key,detail,created_at:nowIso};const {error:eErr}=await supabase.from('match_prematch_events_v280').upsert(e,{onConflict:'event_key',ignoreDuplicates:true});if(!eErr)newEvents.push(e)}
        await supabase.from('match_prematch_events_v280').upsert({event_key:checkKey,fixture_id:fixtureId,event_type:'CHECK_WINDOW',severity:'info',source_window:w.key,detail:{officialSides:state.officialSides,status},created_at:nowIso},{onConflict:'event_key',ignoreDuplicates:true})
        for(const c of state.changes||[])await pushEvent(c.type,c.severity,{side:c.side,detail:c.detail,summary:c.detail},`${c.side}|${sha(c.detail).slice(0,10)}`)
        if(state.decision.changed)await pushEvent('DECISION_CHANGE',state.decision.after==='NO_BET'?'critical':'warning',{before:state.decision.before,after:state.decision.after,summary:`${state.decision.before} → ${state.decision.after}`},`${state.decision.before}|${state.decision.after}`)
        if(state.confidence.afterLevel!==state.confidence.beforeLevel&&state.confidence.after<state.confidence.before)await pushEvent('CONFIDENCE_DROP','warning',{before:state.confidence.before,after:state.confidence.after,beforeLevel:state.confidence.beforeLevel,afterLevel:state.confidence.afterLevel,summary:`${state.confidence.beforeLevel} → ${state.confidence.afterLevel}`},`${state.confidence.beforeLevel}|${state.confidence.afterLevel}`)
        if(Math.abs(num(state.probability.deltaPp))>=4)await pushEvent('PROBABILITY_DELTA',Math.abs(num(state.probability.deltaPp))>=7?'critical':'warning',{marketKey:state.probability.marketKey,before:state.probability.before,after:state.probability.after,deltaPp:state.probability.deltaPp,summary:`${state.probability.before}% → ${state.probability.after}% (${state.probability.deltaPp>=0?'+':''}${state.probability.deltaPp} pp)`},`${w.key}|${state.probability.marketKey}|${state.probability.after}`)
        if(state.market.available&&Math.abs(num(state.market.movePp))>=2)await pushEvent('MARKET_MOVE',Math.abs(num(state.market.movePp))>=3?'warning':'info',{movePp:state.market.movePp,label:state.market.label,summary:`${state.market.label} ${state.market.movePp>=0?'+':''}${state.market.movePp} pp`},`${w.key}|${state.market.label}|${state.market.movePp}`)
        if(state.weather.severity==='HIGH')await pushEvent('WEATHER_SHOCK','warning',{...state.weather,summary:(state.weather.reasons||[]).join(', ')},`HIGH`)

        const {data:lastHist}=await supabase.from('match_decision_history_v280').select('decision,confidence,probability').eq('fixture_id',fixtureId).order('captured_at',{ascending:false}).limit(1)
        const lh=lastHist?.[0]
        if(!lh||lh.decision!==state.decision.after||Math.abs(num(lh.probability)-num(state.probability.after))>=.5||Number(lh.confidence)!==Number(state.confidence.after)){
          await supabase.from('match_decision_history_v280').insert({fixture_id:fixtureId,captured_at:nowIso,source_window:w.key,decision:state.decision.after,confidence:state.confidence.after,market_key:state.probability.marketKey,probability:state.probability.after,xg:state.rescored.xg,reason:(state.flags||[]).join(', ')||'scheduled pre-match refresh',state_snapshot:state})
        }
        alerts+=await fanoutAlerts(supabase,fixture,newEvents)
        processed+=1;seen.add(checkKey)
      }catch(e){errors.push({fixtureId,error:e?.message||String(e)})}
    }
    const status=errors.length?(processed?'partial':'error'):'ok';const metrics={scanned:(snaps||[]).length,due:due.length,processed,skipped,apiCalls,alerts,errors:errors.length,windows:WINDOWS.map(x=>x.key)}
    await logRun(supabase,'prematch_scan',started,status,metrics,errors[0]?.error||null)
    return json(status==='error'?500:200,{ok:status!=='error',...metrics,errors:errors.slice(0,10)})
  }catch(e){await logRun(supabase,'prematch_scan',started,'error',{},e?.message||String(e));return json(500,{ok:false,error:e?.message||String(e)})}
}
exports.handler=handlerCore
exports._test={dueWindow,WINDOWS,relevantEventRules}
