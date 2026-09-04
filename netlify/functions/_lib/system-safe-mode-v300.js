'use strict'
async function getSystemSettingsV300(supabase){
  try{
    const {data,error}=await supabase.from('match_system_settings_v300').select('*').eq('settings_key','football-main').maybeSingle()
    if(error) throw error
    return data||{settings_key:'football-main',safe_mode:false,read_only_mode:false,auto_jobs_enabled:true,backfill_enabled:false,analytics_enabled:true,push_enabled:true}
  }catch(_){
    return {settings_key:'football-main',safe_mode:false,read_only_mode:false,auto_jobs_enabled:true,backfill_enabled:false,analytics_enabled:true,push_enabled:true,table_missing:true}
  }
}
async function runtimeControlV300(supabase,type,key){
  if(!type||!key)return null
  try{const {data,error}=await supabase.from('match_runtime_controls_v300').select('enabled,config').eq('control_type',String(type)).eq('control_key',String(key)).maybeSingle();if(error)throw error;return data||null}catch(_){return null}
}
async function shouldSkipAutoJobV300(supabase,jobKey=''){
  const settings=await getSystemSettingsV300(supabase)
  if(settings.safe_mode||settings.read_only_mode||settings.auto_jobs_enabled===false)return {skip:true,reason:'safe_mode',settings}
  if(jobKey){const ctl=await runtimeControlV300(supabase,'job',jobKey);if(ctl&&ctl.enabled===false)return {skip:true,reason:'job_disabled',settings,control:ctl}}
  return {skip:false,reason:'',settings}
}
module.exports={getSystemSettingsV300,runtimeControlV300,shouldSkipAutoJobV300}
