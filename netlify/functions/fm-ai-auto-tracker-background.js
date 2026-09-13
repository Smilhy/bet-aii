const { runFmAiAutoTrackerV374 } = require('./_lib/fm-ai-auto-tracker-v374')
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||''
function json(statusCode,body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)}}
exports.handler=async(event={})=>{
  if(event.httpMethod==='OPTIONS')return json(204,{})
  if(!['POST','GET'].includes(event.httpMethod||'POST'))return json(405,{ok:false,error:'Method not allowed'})
  const token=String(event.headers?.['x-fm-ai-worker-key']||event.headers?.['X-FM-AI-Worker-Key']||'')
  if(!SERVICE_KEY||token!==SERVICE_KEY)return json(401,{ok:false,error:'Unauthorized'})
  try{return json(200,await runFmAiAutoTrackerV374({maxRuntimeMs:780000,maxFixtures:200,concurrency:2}))}
  catch(error){console.error('fm-ai-auto-tracker-background',error);return json(500,{ok:false,error:String(error?.message||error)})}
}
