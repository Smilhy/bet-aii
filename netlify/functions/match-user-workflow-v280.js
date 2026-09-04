'use strict'
const { createClient } = require('@supabase/supabase-js')
const { getSystemSettingsV300 } = require('./_lib/system-safe-mode-v300')
function json(statusCode,body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS'},body:JSON.stringify(body)}}
function client(){const u=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'';const k=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||'';if(!u||!k)return null;return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})}
function token(event={}){return String(event?.headers?.authorization||event?.headers?.Authorization||'').replace(/^Bearer\s+/i,'').trim()}
async function auth(s,event){const t=token(event);if(!t)return null;const {data,error}=await s.auth.getUser(t);if(error||!data?.user)return null;return data.user}
function clean(v,n=200){return String(v==null?'':v).trim().slice(0,n)}
exports.handler=async function(event={}){if(event.httpMethod==='OPTIONS')return json(204,{});const s=client();if(!s)return json(503,{ok:false,error:'Supabase ENV niedostępne'});const user=await auth(s,event);if(!user)return json(401,{ok:false,error:'Zaloguj się, aby używać watchlisty i alertów.'});const uid=user.id;try{
  if(event.httpMethod==='GET'){
    const fixture=clean(event.queryStringParameters?.fixture,100);const [watchR,alertsR,savedR,digestR,histR]=await Promise.all([
      fixture?s.from('match_user_watchlist_v280').select('*').eq('user_id',uid).eq('fixture_id',fixture).maybeSingle():s.from('match_user_watchlist_v280').select('*').eq('user_id',uid).eq('enabled',true).order('fixture_date',{ascending:true}).limit(100),
      s.from('match_user_alerts_v280').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(50),
      fixture?s.from('match_saved_analysis_v280').select('id,fixture_id,label,created_at').eq('user_id',uid).eq('fixture_id',fixture).order('created_at',{ascending:false}).limit(20):s.from('match_saved_analysis_v280').select('id,fixture_id,label,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(20),
      s.from('match_user_daily_digest_v280').select('*').eq('user_id',uid).order('digest_date',{ascending:false}).limit(1),
      fixture?s.from('match_decision_history_v280').select('captured_at,source_window,decision,confidence,market_key,probability,xg,reason').eq('fixture_id',fixture).order('captured_at',{ascending:true}).limit(60):Promise.resolve({data:[]})
    ]);return json(200,{ok:true,watchlist:watchR.data||null,alerts:alertsR.data||[],unread:(alertsR.data||[]).filter(x=>!x.read_at).length,saved:savedR.data||[],digest:digestR.data?.[0]||null,decisionHistory:histR.data||[]})
  }
  if(event.httpMethod!=='POST')return json(405,{ok:false,error:'Method not allowed'});const systemV300=await getSystemSettingsV300(s);if(systemV300.read_only_mode||systemV300.safe_mode)return json(423,{ok:false,error:'SYSTEM_SAFE_MODE_READ_ONLY'});let body={};try{body=JSON.parse(event.body||'{}')}catch(_){return json(400,{ok:false,error:'Nieprawidłowy JSON'})}const action=clean(body.action,60)
  if(action==='toggle_watchlist'){
    const fixture=clean(body.fixtureId,100);if(!fixture)return json(400,{ok:false,error:'Brak fixtureId'});const enabled=body.enabled!==false;const row={user_id:uid,fixture_id:fixture,fixture_date:body.fixtureDate||null,home_team:clean(body.homeTeam),away_team:clean(body.awayTeam),league:clean(body.league),enabled,rules:body.rules&&typeof body.rules==='object'?body.rules:undefined,updated_at:new Date().toISOString()};Object.keys(row).forEach(k=>row[k]===undefined&&delete row[k]);const {data,error}=await s.from('match_user_watchlist_v280').upsert(row,{onConflict:'user_id,fixture_id'}).select('*').single();if(error)throw error;return json(200,{ok:true,watchlist:data})
  }
  if(action==='update_rules'){
    const fixture=clean(body.fixtureId,100);const rules=body.rules&&typeof body.rules==='object'?body.rules:null;if(!fixture||!rules)return json(400,{ok:false,error:'Brak fixtureId/rules'});const {data,error}=await s.from('match_user_watchlist_v280').update({rules,updated_at:new Date().toISOString()}).eq('user_id',uid).eq('fixture_id',fixture).select('*').maybeSingle();if(error)throw error;return json(200,{ok:true,watchlist:data||null})
  }
  if(action==='save_analysis'){
    const fixture=clean(body.fixtureId,100);const snapshot=body.snapshot&&typeof body.snapshot==='object'?body.snapshot:null;if(!fixture||!snapshot)return json(400,{ok:false,error:'Brak snapshotu'});const raw=JSON.stringify(snapshot);if(raw.length>250000)return json(413,{ok:false,error:'Snapshot jest za duży'});const {data,error}=await s.from('match_saved_analysis_v280').insert({user_id:uid,fixture_id:fixture,label:clean(body.label,120)||'Pre-match analysis',snapshot,created_at:new Date().toISOString()}).select('id,fixture_id,label,created_at').single();if(error)throw error;return json(200,{ok:true,saved:data})
  }
  if(action==='mark_alert_read'){
    const id=Number(body.id);if(!Number.isFinite(id))return json(400,{ok:false,error:'Brak id'});await s.from('match_user_alerts_v280').update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',uid);return json(200,{ok:true})
  }
  if(action==='mark_all_read'){await s.from('match_user_alerts_v280').update({read_at:new Date().toISOString()}).eq('user_id',uid).is('read_at',null);return json(200,{ok:true})}
  return json(400,{ok:false,error:'Nieznana akcja'})
}catch(e){return json(500,{ok:false,error:e?.message||String(e)})}}
