const { runFmAiAutoTrackerV374 } = require('./_lib/fm-ai-auto-tracker-v374')
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||''
exports.handler=async()=>{
  const base=String(process.env.URL||process.env.DEPLOY_PRIME_URL||'').replace(/\/$/,'')
  if(base&&SERVICE_KEY){
    try{
      const r=await fetch(`${base}/.netlify/functions/fm-ai-auto-tracker-background`,{method:'POST',headers:{'Content-Type':'application/json','X-FM-AI-Worker-Key':SERVICE_KEY},body:JSON.stringify({source:'scheduled-v374'})})
      return{statusCode:(r.ok||r.status===202)?200:500,body:JSON.stringify({ok:r.ok||r.status===202,triggered:true,status:r.status})}
    }catch(error){console.warn('V374 background trigger failed, using short fallback',error)}
  }
  try{
    const result=await runFmAiAutoTrackerV374({maxRuntimeMs:18000,maxFixtures:16,concurrency:1})
    return{statusCode:200,body:JSON.stringify({...result,fallback:true})}
  }catch(error){return{statusCode:500,body:JSON.stringify({ok:false,error:String(error?.message||error)})}}
}
