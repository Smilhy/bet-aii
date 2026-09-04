const { createClient } = require('@supabase/supabase-js')

function json(statusCode, body) { return { statusCode, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}, body:JSON.stringify(body) } }
function client(){ const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||''; const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||''; if(!url||!key)return null; try{return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}catch(_){return null} }
function clean(v){return String(v==null?'':v).replace(/[^0-9A-Za-z_-]/g,'').slice(0,100)}

exports.handler = async function(event={}){
  if(event.httpMethod==='OPTIONS')return json(204,{})
  const homeId=clean(event.queryStringParameters?.home), awayId=clean(event.queryStringParameters?.away)
  if(!homeId&&!awayId)return json(200,{ok:true,available:false,home:null,away:null})
  const supabase=client(); if(!supabase)return json(503,{ok:false,error:'Supabase ENV niedostępne'})
  try{
    const ids=[homeId,awayId].filter(Boolean)
    const {data,error}=await supabase.from('match_team_context_registry_v260').select('*').in('team_id',ids)
    if(error){ if(/relation .* does not exist|could not find the table|schema cache/i.test(String(error.message||''))) return json(200,{ok:true,available:false,home:null,away:null,note:'V260 SQL pending'}); throw error }
    const rows=data||[], byId=id=>rows.find(x=>String(x.team_id)===String(id))||null
    return json(200,{ok:true,available:rows.length>0,home:byId(homeId),away:byId(awayId)})
  }catch(error){return json(500,{ok:false,error:error?.message||String(error)})}
}
