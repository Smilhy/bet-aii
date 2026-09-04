'use strict'
const { createClient } = require('@supabase/supabase-js')
const webpush = require('web-push')
const { shouldSkipAutoJobV300 } = require('./_lib/system-safe-mode-v300')
function json(code,body){return{statusCode:code,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)}}
function client(){const u=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'';const k=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||'';return u&&k?createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}}):null}
async function logRun(s,started,status,metrics={},err=null){try{await s.from('match_ops_runs').insert({run_type:'push_dispatch',status,started_at:new Date(started).toISOString(),finished_at:new Date().toISOString(),duration_ms:Date.now()-started,metrics,error_text:err})}catch(_){}}
exports.handler=async()=>{const started=Date.now(),s=client();if(!s)return json(503,{ok:false,error:'Supabase ENV unavailable'});try{
  const gate=await shouldSkipAutoJobV300(s,'push_dispatch');if(gate.skip){await logRun(s,started,'skipped',{safeMode:true});return json(200,{ok:true,skipped:true,reason:'safe_mode'})}
  const pub=process.env.VAPID_PUBLIC_KEY||'',priv=process.env.VAPID_PRIVATE_KEY||'';if(!pub||!priv){await logRun(s,started,'skipped',{vapid:false});return json(200,{ok:true,skipped:true,reason:'VAPID_NOT_CONFIGURED'})}
  webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@bet-ai.app',pub,priv)
  const since=new Date(Date.now()-36*3600000).toISOString()
  const {data:userAlerts,error:aErr}=await s.from('match_user_alerts_v280').select('id,user_id,fixture_id,alert_type,severity,title,message,detail,created_at').gte('created_at',since).order('created_at',{ascending:true}).limit(250)
  if(aErr)throw aErr
  let adminIds=[];try{const {data:profiles}=await s.from('profiles').select('id,email,is_admin,role,username').or('is_admin.eq.true,role.in.(admin,owner,superadmin)').limit(200);adminIds=(profiles||[]).map(x=>x.id).filter(Boolean);const emails=String(process.env.ADMIN_EMAILS||'smilhytv@gmail.com').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);if(emails.length){const {data:byEmail}=await s.from('profiles').select('id,email').in('email',emails);adminIds.push(...(byEmail||[]).map(x=>x.id).filter(Boolean))}}catch(_){}
  adminIds=[...new Set(adminIds)]
  let systemAlerts=[];try{const {data}=await s.from('match_system_alerts_v300').select('id,alert_type,severity,title,message,detail,created_at').is('resolved_at',null).gte('created_at',since).order('created_at',{ascending:true}).limit(80);systemAlerts=data||[]}catch(_){}
  const alerts=[...(userAlerts||[]).map(a=>({...a,delivery_id:Number(a.id)})),...systemAlerts.flatMap(a=>adminIds.map(uid=>({id:a.id,delivery_id:-Number(a.id),user_id:uid,fixture_id:'',alert_type:a.alert_type,severity:a.severity,title:a.title,message:a.message,detail:a.detail,created_at:a.created_at,system:true})))]
  if(!alerts.length){await logRun(s,started,'skipped',{alerts:0});return json(200,{ok:true,sent:0,alerts:0})}
  const userIds=[...new Set(alerts.map(a=>a.user_id).filter(Boolean))]
  const {data:subs,error:sErr}=await s.from('match_push_subscriptions_v300').select('*').in('user_id',userIds).eq('active',true).limit(1000);if(sErr)throw sErr
  const byUser=new Map();for(const sub of subs||[]){if(!byUser.has(sub.user_id))byUser.set(sub.user_id,[]);byUser.get(sub.user_id).push(sub)}
  let sent=0,retry=0,dead=0,skipped=0
  for(const alert of alerts){for(const sub of byUser.get(alert.user_id)||[]){
    const {data:existing}=await s.from('match_push_delivery_v300').select('id,status,attempts').eq('alert_id',alert.delivery_id??alert.id).eq('subscription_id',sub.id).maybeSingle()
    if(existing?.status==='sent'||existing?.status==='dead'){skipped++;continue}
    const payload=JSON.stringify({title:alert.title||'Bet+AI',body:alert.message||'Nowy alert',fixtureId:alert.fixture_id,type:alert.alert_type,severity:alert.severity,url:alert.fixture_id?`/?fixture=${encodeURIComponent(alert.fixture_id)}`:'/'})
    let status='sent',lastError=null,lastStatus=null
    try{const r=await webpush.sendNotification(sub.subscription,payload,{TTL:900,urgency:alert.severity==='critical'?'high':'normal'});lastStatus=r?.statusCode||201;sent++;await s.from('match_push_subscriptions_v300').update({last_success_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',sub.id)}catch(e){lastStatus=e?.statusCode||null;lastError=String(e?.body||e?.message||e).slice(0,1000);if([404,410].includes(Number(lastStatus))){status='dead';dead++;await s.from('match_push_subscriptions_v300').update({active:false,last_error_at:new Date().toISOString(),last_error:lastError,updated_at:new Date().toISOString()}).eq('id',sub.id)}else{status='retry';retry++;await s.from('match_push_subscriptions_v300').update({last_error_at:new Date().toISOString(),last_error:lastError,updated_at:new Date().toISOString()}).eq('id',sub.id)}}
    await s.from('match_push_delivery_v300').upsert({alert_id:alert.delivery_id??alert.id,subscription_id:sub.id,status,attempts:Number(existing?.attempts||0)+1,last_status_code:lastStatus,last_error:lastError,sent_at:status==='sent'?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:'alert_id,subscription_id'})
    if(sent+retry+dead>=160)break
  }}
  const status=retry?'partial':'ok';await logRun(s,started,status,{alerts:alerts.length,userAlerts:(userAlerts||[]).length,systemAlerts:systemAlerts.length,adminRecipients:adminIds.length,subscriptions:subs?.length||0,sent,retry,dead,skipped});return json(200,{ok:true,alerts:alerts.length,sent,retry,dead,skipped})
}catch(e){await logRun(s,started,'error',{},e?.message||String(e));return json(500,{ok:false,error:e?.message||String(e)})}}
