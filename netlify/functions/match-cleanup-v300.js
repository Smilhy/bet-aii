'use strict'
const { createClient }=require('@supabase/supabase-js')
const { shouldSkipAutoJobV300 }=require('./_lib/system-safe-mode-v300')
function json(code,body){return{statusCode:code,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)}}
function client(){const u=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'',k=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';return u&&k?createClient(u,k,{auth:{persistSession:false}}):null}
async function del(s,table,build){try{const {data,error}=await build(s.from(table).delete()).select('id');if(error)throw error;return data?.length||0}catch(_){return 0}}
exports.handler=async()=>{const started=Date.now(),s=client();if(!s)return json(503,{ok:false,error:'Supabase ENV unavailable'});try{const gate=await shouldSkipAutoJobV300(s,'cleanup');if(gate.skip)return json(200,{ok:true,skipped:true,reason:'safe_mode'});const now=Date.now(),days=d=>new Date(now-d*86400000).toISOString();const deleted={};
  // Never delete prediction snapshots, model experiments or freeze ledger.
  deleted.similarityCache=await del(s,'match_similarity_cache_v252',q=>q.lt('expires_at',new Date().toISOString()))
  deleted.opsRuns=await del(s,'match_ops_runs',q=>q.lt('created_at',days(180)))
  deleted.apiHealth=await del(s,'match_api_health_events',q=>q.lt('created_at',days(60)))
  deleted.resolvedAnomalies=await del(s,'match_data_anomalies',q=>q.eq('status','resolved').lt('last_seen_at',days(180)))
  deleted.analytics=await del(s,'match_user_events_v300',q=>q.lt('created_at',days(180)))
  deleted.pushDelivery=await del(s,'match_push_delivery_v300',q=>q.eq('status','sent').lt('created_at',days(60)))
  deleted.inactivePush=await del(s,'match_push_subscriptions_v300',q=>q.eq('active',false).lt('updated_at',days(365)))
  const {error}=await s.from('match_cleanup_runs_v300').insert({status:'ok',deleted,note:'Immutable prediction history and Freeze Ledger are never deleted by V300.',created_at:new Date().toISOString()});if(error)throw error
  try{await s.from('match_ops_runs').insert({run_type:'cleanup',status:'ok',started_at:new Date(started).toISOString(),finished_at:new Date().toISOString(),duration_ms:Date.now()-started,metrics:{deleted}})}catch(_){}
  return json(200,{ok:true,deleted})
}catch(e){try{await s.from('match_cleanup_runs_v300').insert({status:'error',deleted:{},note:String(e?.message||e)})}catch(_){};return json(500,{ok:false,error:e?.message||String(e)})}}
