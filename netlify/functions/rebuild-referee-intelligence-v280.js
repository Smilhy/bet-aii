'use strict'
const { createClient } = require('@supabase/supabase-js')
const { apiGet } = require('./_lib/match-simulator-rate-shield')
const { logRun } = require('./_lib/match-ops-v211')
const { safe, num, norm, round } = require('./_lib/prematch-v280')
const { shouldSkipAutoJobV300 } = require('./_lib/system-safe-mode-v300')
function json(statusCode,body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)}}
function client(){const u=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'';const k=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||'';if(!u||!k)return null;try{return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})}catch(_){return null}}
function statValue(rows=[],type=''){let total=0;for(const team of rows||[]){const s=(team?.statistics||[]).find(x=>safe(x?.type).toLowerCase()===String(type).toLowerCase());total+=num(s?.value)}return total}
function penaltyEvents(rows=[]){return(rows||[]).filter(e=>safe(e?.type).toLowerCase()==='goal'&&/penalty/i.test(safe(e?.detail))).length}
async function rebuildProfile(supabase,key,name){const {data}=await supabase.from('match_referee_samples_v280').select('*').eq('referee_key',key).order('fixture_date',{ascending:false}).limit(250);const rows=data||[];if(!rows.length)return;const avg=f=>rows.reduce((s,r)=>s+num(r?.[f]),0)/rows.length;await supabase.from('match_referee_profiles_v280').upsert({referee_key:key,referee_name:name,sample_size:rows.length,avg_yellow:round(avg('yellow_cards'),3),avg_red:round(avg('red_cards'),3),avg_fouls:round(avg('fouls'),3),avg_penalties:round(avg('penalties'),3),avg_goals:round(avg('total_goals'),3),last_fixture_date:rows[0]?.fixture_date||null,updated_at:new Date().toISOString()},{onConflict:'referee_key'})}
exports.handler=async function(event={}){const started=Date.now(),supabase=client();if(!supabase)return json(503,{ok:false,error:'Supabase ENV niedostępne'});const gateV300=await shouldSkipAutoJobV300(supabase,'referee_rebuild');if(gateV300.skip)return json(200,{ok:true,skipped:true,reason:'SYSTEM_SAFE_MODE'});try{
  const since=new Date(Date.now()-21*86400000).toISOString();const {data:snaps,error}=await supabase.from('match_prediction_snapshots').select('fixture_id,fixture_date,league,actual_home_goals,actual_away_goals,settled_at').not('settled_at','is',null).gte('fixture_date',since).order('fixture_date',{ascending:false}).limit(100);if(error)throw error
  const ids=(snaps||[]).map(x=>String(x.fixture_id));const {data:done}=ids.length?await supabase.from('match_referee_samples_v280').select('fixture_id').in('fixture_id',ids):{data:[]};const seen=new Set((done||[]).map(x=>String(x.fixture_id)))
  let processed=0,skipped=0,apiCalls=0,errors=[]
  for(const s of snaps||[]){if(processed>=5)break;const id=String(s.fixture_id);if(seen.has(id)){skipped++;continue}
    try{const {data:sim}=await supabase.from('match_simulator_snapshots').select('payload').eq('fixture_id',id).maybeSingle();const refName=safe(sim?.payload?.fixture?.referee);if(!refName){skipped++;continue}const key=norm(refName);if(!key){skipped++;continue}
      const [statsR,eventsR]=await Promise.all([
        apiGet('/fixtures/statistics',{fixture:id},{budgetScope:'referee-v280',budgetLimit:36,totalBudgetLimit:750,ttlMs:30*86400000,allowStaleMs:60*86400000,attempts:2,timeoutMs:8000}),
        apiGet('/fixtures/events',{fixture:id},{budgetScope:'referee-v280',budgetLimit:36,totalBudgetLimit:750,ttlMs:30*86400000,allowStaleMs:60*86400000,attempts:2,timeoutMs:8000})
      ]);if(statsR?.ok&&!statsR.fromCache)apiCalls++;if(eventsR?.ok&&!eventsR.fromCache)apiCalls++
      if(!statsR?.ok){errors.push({fixtureId:id,error:statsR?.error||'statistics unavailable'});continue}
      const row={fixture_id:id,referee_key:key,referee_name:refName,fixture_date:s.fixture_date||null,league:s.league||'',yellow_cards:Math.round(statValue(statsR.data,'Yellow Cards')),red_cards:Math.round(statValue(statsR.data,'Red Cards')),fouls:Math.round(statValue(statsR.data,'Fouls')),penalties:eventsR?.ok?penaltyEvents(eventsR.data):0,total_goals:Math.max(0,Math.round(num(s.actual_home_goals)+num(s.actual_away_goals))),captured_at:new Date().toISOString()}
      const {error:ins}=await supabase.from('match_referee_samples_v280').upsert(row,{onConflict:'fixture_id'});if(ins)throw ins;await rebuildProfile(supabase,key,refName);processed++
    }catch(e){errors.push({fixtureId:id,error:e?.message||String(e)})}
  }
  const status=errors.length?(processed?'partial':'error'):'ok';const metrics={scanned:(snaps||[]).length,processed,skipped,apiCalls,errors:errors.length};await logRun(supabase,'referee_rebuild',started,status,metrics,errors[0]?.error||null);return json(status==='error'?500:200,{ok:status!=='error',...metrics,errors:errors.slice(0,10)})
}catch(e){await logRun(supabase,'referee_rebuild',started,'error',{},e?.message||String(e));return json(500,{ok:false,error:e?.message||String(e)})}}
exports._test={statValue,penaltyEvents}
