'use strict'
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('./_admin-payout-security')
const { getSystemSettingsV300 } = require('./_lib/system-safe-mode-v300')

const CORS = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Admin-Secret',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Cache-Control':'no-store'
}
function json(code,body){return{statusCode:code,headers:{...CORS,'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(body)}}
function text(code,body,type='text/plain; charset=utf-8',filename=''){const h={...CORS,'Content-Type':type};if(filename)h['Content-Disposition']=`attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]+/g,'_')}"`;return{statusCode:code,headers:h,body}}
function client(){const u=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'';const k=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||process.env.SERVICE_ROLE_KEY||'';if(!u||!k)return null;return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})}
function token(event={}){return String(event?.headers?.authorization||event?.headers?.Authorization||'').replace(/^Bearer\s+/i,'').trim()}
async function userFromEvent(s,event){const t=token(event);if(!t)return null;try{const {data,error}=await s.auth.getUser(t);return error?null:data?.user||null}catch(_){return null}}
function clean(v,n=200){return String(v==null?'':v).trim().slice(0,n)}
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function round(v,d=1){const f=10**d;return Math.round(n(v)*f)/f}
function hash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function safeJson(v,max=12000){try{const x=JSON.stringify(v&&typeof v==='object'?v:{});return x.length<=max?JSON.parse(x):{truncated:true}}catch(_){return{}}}
function tableMissing(e){return /relation .* does not exist|could not find the table|schema cache/i.test(String(e?.message||e||''))}
async function rowsOr(s,table,build,fallback=[]){try{const q=build(s.from(table));const {data,error}=await q;if(error)throw error;return data||fallback}catch(e){if(tableMissing(e))return fallback;throw e}}
async function countOr(s,table,build){try{const q=build(s.from(table).select('*',{count:'exact',head:true}));const {count,error}=await q;if(error)throw error;return Number(count||0)}catch(e){if(tableMissing(e))return 0;throw e}}
function forecastDecision(f={}){return f?.professionalLab?.decisionCard?.decision||f?.value?.top?.classification||f?.decision?.decision||''}
function forecastProb(f={}){const p=f?.professionalLab?.decisionCard?.conservativeProbability??f?.value?.top?.probability??f?.oneXTwo?.home;return Number.isFinite(Number(p))?Number(p):null}
function probs1x2(f={}){const x=f?.oneXTwo||f?.calibrated?.oneXTwo||{};let h=n(x.home,NaN),d=n(x.draw,NaN),a=n(x.away,NaN);if(![h,d,a].every(Number.isFinite))return null;const sum=h+d+a;if(sum<=0)return null;if(sum<=1.5){h*=100;d*=100;a*=100}return{home:h,draw:d,away:a}}
function brier1x2(f,gh,ga){const p=probs1x2(f);if(!p)return null;const actual=gh>ga?'home':gh<ga?'away':'draw';return ((p.home/100-(actual==='home'?1:0))**2+(p.draw/100-(actual==='draw'?1:0))**2+(p.away/100-(actual==='away'?1:0))**2)/3}
function accuracy1x2(f,gh,ga){const p=probs1x2(f);if(!p)return null;const pick=Object.entries(p).sort((a,b)=>b[1]-a[1])[0]?.[0];const actual=gh>ga?'home':gh<ga?'away':'draw';return pick===actual}
function csvCell(v){const s=typeof v==='object'?JSON.stringify(v):String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}

function ascii(v=''){return String(v??'').normalize('NFKD').replace(/[^\x20-\x7E]/g,'').replace(/[()\\]/g,m=>`\\${m}`).slice(0,180)}
function simplePdf(rows=[]){
  const lines=['Bet+AI Prediction History V300',`Exported: ${new Date().toISOString()}`,'',...rows.slice(0,160).map(r=>`${String(r.date||'').slice(0,10)} | ${ascii(r.home)} - ${ascii(r.away)} | ${ascii(r.league)} | ${ascii(r.actual)} | ${ascii(r.decision)} | Q${r.dataQuality??''}`)]
  const per=46,pages=[];for(let i=0;i<lines.length;i+=per)pages.push(lines.slice(i,i+per))
  const objects=[];const add=x=>{objects.push(x);return objects.length}
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const pagesId=add('PAGES_PLACEHOLDER')
  const pageIds=[]
  for(const pg of pages){let stream='BT\n/F1 9 Tf\n40 800 Td\n';pg.forEach((line,i)=>{if(i)stream+='0 -16 Td\n';stream+=`(${ascii(line)}) Tj\n`});stream+='ET';const content=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);const page=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);pageIds.push(page)}
  objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  const catalog=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  let pdf='%PDF-1.4\n',offsets=[0]
  objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`})
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf,'binary')
}

async function featureFlags(s){return rowsOr(s,'match_feature_flags_v300',q=>q.select('flag_key,enabled,rollout_pct,admin_only,description,config,updated_at').order('flag_key'),[])}
async function coverage(s,days=30){
  const since=new Date(Date.now()-Math.max(1,Math.min(365,days))*86400000).toISOString()
  const [snap,prem,odds,context]=await Promise.all([
    rowsOr(s,'match_prediction_snapshots',q=>q.select('fixture_id,fixture_date,data_quality,forecast').gte('fixture_date',since).limit(10000),[]),
    rowsOr(s,'match_prematch_state_v280',q=>q.select('fixture_id,official_lineups,official_sides,lineup_payload,injuries_payload,weather_payload,referee_payload,travel_payload,updated_at').gte('fixture_date',since).limit(10000),[]),
    rowsOr(s,'match_odds_timeline',q=>q.select('fixture_id,snapshot_window,is_closing_candidate').gte('fixture_date',since).limit(20000),[]),
    rowsOr(s,'match_context_snapshots_v220',q=>q.select('fixture_id,context').gte('fixture_date',since).limit(10000),[])
  ])
  const ids=new Set(snap.map(x=>String(x.fixture_id))), denom=Math.max(1,ids.size)
  const byPrem=new Map(prem.map(x=>[String(x.fixture_id),x])),byCtx=new Map(context.map(x=>[String(x.fixture_id),x]))
  const oddMap={};for(const x of odds){const id=String(x.fixture_id);if(!oddMap[id])oddMap[id]=new Set();oddMap[id].add(x.snapshot_window)}
  let lineups=0,injuries=0,weather=0,referee=0,travel=0,closing=0,contextN=0,highQuality=0
  for(const row of snap){const id=String(row.fixture_id),p=byPrem.get(id),c=byCtx.get(id);if(p?.official_lineups||n(p?.official_sides)>0)lineups++;if(Object.keys(p?.injuries_payload||{}).length)injuries++;if(p?.weather_payload?.raw?.available||p?.weather_payload?.adjusted?.available)weather++;if(p?.referee_payload?.adjusted?.available)referee++;if(p?.travel_payload?.available)travel++;if(oddMap[id]?.has('T15M')||oddMap[id]?.has('CLOSING'))closing++;if(c?.context&&Object.keys(c.context).length)contextN++;if(n(row.data_quality)>=70)highQuality++}
  const pct=x=>round(x/denom*100,1)
  return {days,fixtures:ids.size,lineups:pct(lineups),injuries:pct(injuries),weather:pct(weather),referee:pct(referee),travel:pct(travel),closingLine:pct(closing),context:pct(contextN),highQuality:pct(highQuality)}
}
async function modelComparison(s){
  const [rows,snapshots]=await Promise.all([
    rowsOr(s,'match_model_experiments',q=>q.select('model_version,model_role,forecast,actual_home_goals,actual_away_goals,settled_at').eq('status','settled').not('actual_home_goals','is',null).not('actual_away_goals','is',null).order('settled_at',{ascending:false}).limit(12000),[]),
    rowsOr(s,'match_prediction_snapshots',q=>q.select('model_version,forecast,actual_home_goals,actual_away_goals,settled_at').not('actual_home_goals','is',null).not('actual_away_goals','is',null).order('settled_at',{ascending:false}).limit(12000),[])
  ])
  const g=new Map()
  const addRow=(r,role='')=>{const key=clean(r.model_version,100)||clean(role,40)||'unknown';if(!g.has(key))g.set(key,{version:key,role:role||'',samples:0,brier:0,brierN:0,correct:0,accN:0});const x=g.get(key);x.samples++;const b=brier1x2(r.forecast,n(r.actual_home_goals),n(r.actual_away_goals));if(b!=null){x.brier+=b;x.brierN++}const a=accuracy1x2(r.forecast,n(r.actual_home_goals),n(r.actual_away_goals));if(a!=null){x.correct+=a?1:0;x.accN++}}
  for(const r of rows)addRow(r,r.model_role||'EXPERIMENT')
  for(const r of snapshots)addRow(r,'SNAPSHOT')
  return [...g.values()].map(x=>({version:x.version,role:x.role,samples:x.samples,brier:x.brierN?round(x.brier/x.brierN,4):null,accuracy:x.accN?round(x.correct/x.accN*100,1):null})).filter(x=>x.samples>=1).sort((a,b)=>((a.brier??99)-(b.brier??99))||b.samples-a.samples)
}
async function healthNow(s){
  const now=Date.now(),since24=new Date(now-86400000).toISOString(),since7=new Date(now-7*86400000).toISOString(),settleCutoff=new Date(now-105*60000).toISOString()
  const [cov,runs,api,anoms,pending,frozen,settings]=await Promise.all([
    coverage(s,30),
    rowsOr(s,'match_ops_runs',q=>q.select('run_type,status,started_at,error_text,metrics').gte('started_at',since24).order('started_at',{ascending:false}).limit(300),[]),
    rowsOr(s,'match_api_health_events',q=>q.select('event_type,status_code,created_at').gte('created_at',since24).limit(1000),[]),
    rowsOr(s,'match_data_anomalies',q=>q.select('severity,status').eq('status','open').gte('last_seen_at',since7).limit(1000),[]),
    countOr(s,'match_prediction_snapshots',q=>q.is('settled_at',null).lt('fixture_date',settleCutoff)),
    countOr(s,'match_prediction_freeze_ledger',q=>q),
    getSystemSettingsV300(s)
  ])
  const latest={};for(const r of runs)if(!latest[r.run_type])latest[r.run_type]=r
  const critical=anoms.filter(x=>x.severity==='critical').length,warnings=anoms.filter(x=>x.severity==='warning').length
  const apiErrors=api.filter(x=>['RATE_LIMIT','HTTP_ERROR','TIMEOUT','BUDGET_BLOCK'].includes(x.event_type)).length
  const jobTypes=['settlement','odds_snapshot','model_rebuild','anomaly_scan','prematch_scan'];let jobGood=0
  for(const k of jobTypes){const r=latest[k];if(r&&['ok','partial','skipped'].includes(r.status))jobGood++}
  const jobsScore=round(jobGood/jobTypes.length*100,0)
  const coverageScore=round((cov.lineups+cov.closingLine+cov.context+cov.highQuality)/4,0)
  const integrityScore=Math.max(0,100-critical*25-warnings*3-Math.min(30,pending*2))
  const apiScore=Math.max(0,100-Math.min(60,apiErrors*6))
  const modelScore=latest.model_rebuild?.status==='error'?55:latest.model_rebuild?95:70
  let score=round(coverageScore*.22+jobsScore*.24+integrityScore*.24+apiScore*.18+modelScore*.12,0)
  if(settings.safe_mode)score=Math.min(score,72)
  const status=score>=90?'HEALTHY':score>=75?'GOOD':score>=55?'WATCH':'CRITICAL'
  const alerts=[];if(settings.safe_mode)alerts.push('SYSTEM SAFE MODE jest aktywny.');if(critical)alerts.push(`${critical} krytycznych anomalii danych.`);if(pending)alerts.push(`${pending} prognoz oczekuje na settlement.`);if(apiErrors>=5)alerts.push(`${apiErrors} problemów API w 24h.`);if(cov.closingLine<50)alerts.push(`Closing-line coverage tylko ${cov.closingLine}%.`)
  return {score,status,components:{coverage:coverageScore,jobs:jobsScore,integrity:integrityScore,api:apiScore,model:modelScore},counters:{pendingSettlement:pending,frozenPredictions:frozen,criticalAnomalies:critical,warnings,apiErrors24h:apiErrors},coverage:cov,alerts,latestRuns:latest,settings}
}
async function timeline(s,fixture){
  if(!fixture)return {fixture:'',freezes:[],odds:[],events:[],decisions:[]}
  const [freezes,odds,events,decisions]=await Promise.all([
    rowsOr(s,'match_prediction_freeze_ledger',q=>q.select('captured_at,model_version,active_model,data_quality,forecast,freeze_hash,canonical_hash_v211,selected_for_backtest').eq('fixture_id',fixture).order('captured_at',{ascending:true}).limit(80),[]),
    rowsOr(s,'match_odds_timeline',q=>q.select('captured_at,snapshot_window,market_key,bookmaker,odds,model_probability,edge_pp,is_closing_candidate').eq('fixture_id',fixture).order('captured_at',{ascending:true}).limit(1000),[]),
    rowsOr(s,'match_prematch_events_v280',q=>q.select('created_at,event_type,severity,source_window,detail').eq('fixture_id',fixture).order('created_at',{ascending:true}).limit(200),[]),
    rowsOr(s,'match_decision_history_v280',q=>q.select('captured_at,source_window,decision,confidence,market_key,probability,xg,reason').eq('fixture_id',fixture).order('captured_at',{ascending:true}).limit(200),[])
  ])
  return {fixture,freezes,odds,events,decisions}
}
async function historical(s,qs={}){
  const limit=Math.max(10,Math.min(300,Number(qs.limit||80))),league=clean(qs.league,120),model=clean(qs.model,120),search=clean(qs.search,120).toLowerCase(),minQuality=Math.max(0,Math.min(100,Number(qs.minQuality||0)))
  let q=s.from('match_prediction_snapshots').select('fixture_id,fixture_date,home_team,away_team,league,country,model_version,data_quality,source_count,consensus_agreement,forecast,actual_home_goals,actual_away_goals,settled_at').not('actual_home_goals','is',null).not('actual_away_goals','is',null).gte('data_quality',minQuality).order('fixture_date',{ascending:false}).limit(Math.max(limit,search?300:limit))
  if(league)q=q.eq('league',league);if(model)q=q.eq('model_version',model)
  const {data,error}=await q;if(error)throw error
  let arr=data||[];if(search)arr=arr.filter(x=>`${x.home_team} ${x.away_team} ${x.league}`.toLowerCase().includes(search));arr=arr.slice(0,limit)
  return arr.map(x=>({fixtureId:x.fixture_id,date:x.fixture_date,home:x.home_team,away:x.away_team,league:x.league,country:x.country,model:x.model_version,dataQuality:x.data_quality,sources:x.source_count,consensus:x.consensus_agreement,actual:`${x.actual_home_goals}-${x.actual_away_goals}`,decision:forecastDecision(x.forecast),probability:forecastProb(x.forecast),brier:brier1x2(x.forecast,n(x.actual_home_goals),n(x.actual_away_goals))}))
}
async function adminPayload(s,event){
  const a=await requireAdmin(event,s,{});if(!a.ok)return {admin:false}
  const [settings,flags,experiments,backups,retry,backfill,cleanup,push,runtimeControls,leagueRows]=await Promise.all([
    getSystemSettingsV300(s),featureFlags(s),rowsOr(s,'match_ab_experiments_v300',q=>q.select('*').order('experiment_key'),[]),rowsOr(s,'match_config_backups_v300',q=>q.select('id,label,created_at,restored_at').order('created_at',{ascending:false}).limit(20),[]),rowsOr(s,'match_retry_queue_v300',q=>q.select('id,job_key,target_function,status,attempts,max_attempts,next_attempt_at,last_error,updated_at').in('status',['pending','retry','dead']).order('updated_at',{ascending:false}).limit(50),[]),rowsOr(s,'match_backfill_queue_v300',q=>q.select('id,fixture_id,backfill_type,status,attempts,last_error,updated_at').in('status',['pending','retry','dead']).order('updated_at',{ascending:false}).limit(50),[]),rowsOr(s,'match_cleanup_runs_v300',q=>q.select('*').order('created_at',{ascending:false}).limit(10),[]),countOr(s,'match_push_subscriptions_v300',q=>q.eq('active',true)),rowsOr(s,'match_runtime_controls_v300',q=>q.select('*').order('control_type').order('control_key'),[]),rowsOr(s,'match_prediction_snapshots',q=>q.select('league').not('league','is',null).order('fixture_date',{ascending:false}).limit(1500),[])
  ])
  const leagueOptions=[...new Set((leagueRows||[]).map(x=>clean(x.league,120)).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).slice(0,80)
  return {admin:true,identity:{id:a.admin_user_id||null,email:a.email||null,via:a.via},settings,flags,experiments,backups,retry,backfill,cleanup,runtimeControls,leagueOptions,activePushSubscriptions:push}
}
async function backupConfig(s,admin,label=''){const tables=['match_system_settings_v300','match_feature_flags_v300','match_runtime_controls_v300','match_ab_experiments_v300','match_model_canary_state','match_model_registry'];const snap={version:300,createdAt:new Date().toISOString(),tables:{}};for(const t of tables)snap.tables[t]=await rowsOr(s,t,q=>q.select('*').limit(500),[]);const raw=JSON.stringify(snap),h=hash(raw);const {data,error}=await s.from('match_config_backups_v300').insert({label:clean(label,160)||`V300 config ${new Date().toISOString()}`,created_by:admin.admin_user_id||null,snapshot:snap,snapshot_hash:h}).select('id,label,created_at,snapshot_hash').single();if(error)throw error;return data}
async function restoreConfig(s,admin,id){const {data,error}=await s.from('match_config_backups_v300').select('*').eq('id',Number(id)).maybeSingle();if(error||!data)throw new Error(error?.message||'Backup not found');const allowed=new Set(['match_system_settings_v300','match_feature_flags_v300','match_runtime_controls_v300','match_ab_experiments_v300','match_model_canary_state','match_model_registry']);for(const [t,rows] of Object.entries(data.snapshot?.tables||{})){if(!allowed.has(t)||!Array.isArray(rows)||!rows.length)continue;let conflict=t==='match_system_settings_v300'?'settings_key':t==='match_feature_flags_v300'?'flag_key':t==='match_runtime_controls_v300'?'control_type,control_key':t==='match_ab_experiments_v300'?'experiment_key':'registry_key';const {error:e}=await s.from(t).upsert(rows,{onConflict:conflict});if(e&&!tableMissing(e))throw e}await s.from('match_config_backups_v300').update({restored_at:new Date().toISOString(),restored_by:admin.admin_user_id||null}).eq('id',Number(id));return {id:Number(id),restored:true}}

exports.handler=async function(event={}){
  if(event.httpMethod==='OPTIONS')return json(204,{})
  const s=client();if(!s)return json(503,{ok:false,error:'Supabase ENV unavailable'})
  const qs=event.queryStringParameters||{},mode=clean(qs.mode||'dashboard',60)
  try{
    if(event.httpMethod==='GET'){
      if(mode==='push_config')return json(200,{ok:true,enabled:Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY),publicKey:process.env.VAPID_PUBLIC_KEY||''})
      if(mode==='history')return json(200,{ok:true,rows:await historical(s,qs)})
      if(mode==='timeline')return json(200,{ok:true,timeline:await timeline(s,clean(qs.fixture,100))})
      if(mode==='models')return json(200,{ok:true,models:await modelComparison(s)})
      if(mode==='coverage')return json(200,{ok:true,coverage:await coverage(s,Number(qs.days||30))})
      if(mode==='admin')return json(200,{ok:true,...await adminPayload(s,event)})
      if(mode==='export'){
        const format=clean(qs.format||'csv',10).toLowerCase(),rows=await historical(s,{...qs,limit:Math.min(1000,Number(qs.limit||1000))})
        if(format==='json')return text(200,JSON.stringify({version:300,exportedAt:new Date().toISOString(),rows},null,2),'application/json; charset=utf-8','betai_prediction_history_v300.json')
        if(format==='pdf'){const b=simplePdf(rows);return{statusCode:200,headers:{...CORS,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename=\"betai_prediction_history_v300.pdf\"'},isBase64Encoded:true,body:b.toString('base64')}}
        const cols=['fixtureId','date','home','away','league','country','model','dataQuality','sources','consensus','actual','decision','probability','brier'];const body=[cols.join(','),...rows.map(r=>cols.map(c=>csvCell(r[c])).join(','))].join('\n');return text(200,body,'text/csv; charset=utf-8','betai_prediction_history_v300.csv')
      }
      const [health,flags,models,admin,runtimeControls]=await Promise.all([healthNow(s),featureFlags(s),modelComparison(s),adminPayload(s,event),rowsOr(s,'match_runtime_controls_v300',q=>q.select('control_type,control_key,enabled,config,updated_at').in('control_type',['market','league','module']).order('control_type').order('control_key'),[])])
      const latest=await rowsOr(s,'match_system_health_v300',q=>q.select('score,status,components,counters,alerts,measured_at').eq('health_key','football-main').order('measured_at',{ascending:false}).limit(1),[])
      return json(200,{ok:true,version:300,health,latestStoredHealth:latest[0]||null,flags:flags.filter(f=>!f.admin_only),models:models.slice(0,12),runtimeControls,admin})
    }
    if(event.httpMethod!=='POST')return json(405,{ok:false,error:'Method not allowed'})
    let body={};try{body=JSON.parse(event.body||'{}')}catch(_){return json(400,{ok:false,error:'Invalid JSON'})}
    const action=clean(body.action,80),user=await userFromEvent(s,event)
    const writeSettingsV300=await getSystemSettingsV300(s)
    if((writeSettingsV300.safe_mode||writeSettingsV300.read_only_mode)&&['analytics','ab_assign','push_subscribe','push_unsubscribe'].includes(action))return json(423,{ok:false,error:'SYSTEM_SAFE_MODE_READ_ONLY'})
    if(action==='analytics'){
      const settings=await getSystemSettingsV300(s);if(settings.analytics_enabled===false)return json(200,{ok:true,stored:false,reason:'analytics_disabled'})
      const eventName=clean(body.eventName,80);if(!eventName)return json(400,{ok:false,error:'eventName required'})
      const detail=safeJson(body.detail,5000);const row={user_id:user?.id||null,session_key:clean(body.sessionKey,100)||null,event_name:eventName,fixture_id:clean(body.fixtureId,100)||null,league:clean(body.league,120)||null,feature_key:clean(body.featureKey,100)||null,variant:clean(body.variant,80)||null,detail,created_at:new Date().toISOString()};const {error}=await s.from('match_user_events_v300').insert(row);if(error&&!tableMissing(error))throw error;return json(200,{ok:true,stored:!error})
    }
    if(action==='ab_assign'){
      const exp=clean(body.experimentKey,100),subject=clean(body.subjectKey,160);if(!exp||!subject)return json(400,{ok:false,error:'experimentKey/subjectKey required'});const {data:e}=await s.from('match_ab_experiments_v300').select('*').eq('experiment_key',exp).maybeSingle();if(!e?.enabled)return json(200,{ok:true,variant:'control',enabled:false});const existing=await rowsOr(s,'match_ab_assignments_v300',q=>q.select('*').eq('experiment_key',exp).eq('subject_key',subject).limit(1),[]);if(existing[0])return json(200,{ok:true,variant:existing[0].variant,enabled:true});const alloc=e.allocation||{},variants=Array.isArray(e.variants)?e.variants:Object.keys(alloc),bucket=parseInt(hash(`${exp}|${subject}`).slice(0,8),16)%100;let acc=0,variant=variants[0]||'control';for(const v of variants){acc+=n(alloc[v],0);if(bucket<acc){variant=v;break}}await s.from('match_ab_assignments_v300').upsert({experiment_key:exp,subject_key:subject,user_id:user?.id||null,variant,assigned_at:new Date().toISOString()},{onConflict:'experiment_key,subject_key'});return json(200,{ok:true,variant,enabled:true})
    }
    if(action==='push_subscribe'||action==='push_unsubscribe'){
      if(!user)return json(401,{ok:false,error:'Login required'});const settings=await getSystemSettingsV300(s);if(settings.push_enabled===false)return json(409,{ok:false,error:'Push disabled by administrator'});const sub=body.subscription&&typeof body.subscription==='object'?body.subscription:null,endpoint=clean(sub?.endpoint||body.endpoint,2000);if(!endpoint)return json(400,{ok:false,error:'Push endpoint missing'});if(action==='push_unsubscribe'){await s.from('match_push_subscriptions_v300').update({active:false,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('endpoint',endpoint);return json(200,{ok:true,active:false})}const row={user_id:user.id,endpoint,subscription:sub,user_agent:clean(body.userAgent,500)||null,active:true,last_error:null,updated_at:new Date().toISOString()};const {data,error}=await s.from('match_push_subscriptions_v300').upsert(row,{onConflict:'endpoint'}).select('id,active,created_at,updated_at').single();if(error)throw error;return json(200,{ok:true,subscription:data})
    }
    const admin=await requireAdmin(event,s,body);if(!admin.ok)return json(admin.statusCode||403,{ok:false,error:admin.error})
    if(action==='set_system'){
      const patch={updated_at:new Date().toISOString(),updated_by:admin.admin_user_id||null};for(const k of ['safe_mode','read_only_mode','auto_jobs_enabled','backfill_enabled','analytics_enabled','push_enabled'])if(typeof body[k]==='boolean')patch[k]=body[k];if(body.safe_mode_reason!=null)patch.safe_mode_reason=clean(body.safe_mode_reason,500);if(body.config&&typeof body.config==='object')patch.config=safeJson(body.config,20000);if(patch.safe_mode===true){patch.read_only_mode=true;patch.auto_jobs_enabled=false}else if(patch.safe_mode===false&&body.restoreAutoJobs!==false){patch.read_only_mode=false;patch.auto_jobs_enabled=true}const {data,error}=await s.from('match_system_settings_v300').update(patch).eq('settings_key','football-main').select('*').single();if(error)throw error;return json(200,{ok:true,settings:data})
    }
    if(action==='set_flag'){
      const key=clean(body.flagKey,120);if(!key)return json(400,{ok:false,error:'flagKey required'});const patch={flag_key:key,updated_at:new Date().toISOString(),updated_by:admin.admin_user_id||null};if(typeof body.enabled==='boolean')patch.enabled=body.enabled;if(body.rolloutPct!=null)patch.rollout_pct=Math.max(0,Math.min(100,Math.round(n(body.rolloutPct))));if(typeof body.adminOnly==='boolean')patch.admin_only=body.adminOnly;if(body.config&&typeof body.config==='object')patch.config=safeJson(body.config,10000);const {data,error}=await s.from('match_feature_flags_v300').upsert(patch,{onConflict:'flag_key'}).select('*').single();if(error)throw error;return json(200,{ok:true,flag:data})
    }
    if(action==='set_runtime_control'){
      const type=clean(body.controlType,30),key=clean(body.controlKey,160);if(!['job','market','league','module'].includes(type)||!key)return json(400,{ok:false,error:'valid controlType/controlKey required'});const patch={control_type:type,control_key:key,enabled:typeof body.enabled==='boolean'?body.enabled:true,config:body.config&&typeof body.config==='object'?safeJson(body.config,10000):{},updated_at:new Date().toISOString(),updated_by:admin.admin_user_id||null};const {data,error}=await s.from('match_runtime_controls_v300').upsert(patch,{onConflict:'control_type,control_key'}).select('*').single();if(error)throw error;return json(200,{ok:true,control:data})
    }
    if(action==='set_experiment'){
      const key=clean(body.experimentKey,120);if(!key)return json(400,{ok:false,error:'experimentKey required'});const patch={experiment_key:key,updated_at:new Date().toISOString()};if(typeof body.enabled==='boolean')patch.enabled=body.enabled;if(body.variants)patch.variants=safeJson(body.variants,3000);if(body.allocation)patch.allocation=safeJson(body.allocation,3000);if(body.description!=null)patch.description=clean(body.description,500);const {data,error}=await s.from('match_ab_experiments_v300').upsert(patch,{onConflict:'experiment_key'}).select('*').single();if(error)throw error;return json(200,{ok:true,experiment:data})
    }
    if(action==='create_backup')return json(200,{ok:true,backup:await backupConfig(s,admin,body.label)})
    if(action==='restore_backup')return json(200,{ok:true,restore:await restoreConfig(s,admin,body.id)})
    if(action==='queue_backfill'){
      const fixture=clean(body.fixtureId,100),type=clean(body.backfillType||'existing_data_repair',80);if(!fixture)return json(400,{ok:false,error:'fixtureId required'});const {data,error}=await s.from('match_backfill_queue_v300').upsert({fixture_id:fixture,backfill_type:type,priority:Math.max(1,Math.min(100,n(body.priority,50))),status:'pending',payload:safeJson(body.payload,8000),updated_at:new Date().toISOString()},{onConflict:'fixture_id,backfill_type'}).select('*').single();if(error)throw error;return json(200,{ok:true,backfill:data})
    }
    if(action==='retry_job'){
      const id=Number(body.id);if(!Number.isFinite(id))return json(400,{ok:false,error:'id required'});const {data,error}=await s.from('match_retry_queue_v300').update({status:'pending',next_attempt_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',id).select('*').maybeSingle();if(error)throw error;return json(200,{ok:true,retry:data})
    }
    if(action==='health_snapshot'){
      const h=await healthNow(s);const {data,error}=await s.from('match_system_health_v300').insert({health_key:'football-main',score:h.score,status:h.status,components:h.components,counters:{...h.counters,coverage:h.coverage},alerts:h.alerts,measured_at:new Date().toISOString()}).select('*').single();if(error)throw error;return json(200,{ok:true,health:data})
    }
    return json(400,{ok:false,error:'Unknown action'})
  }catch(e){return json(500,{ok:false,error:e?.message||String(e)})}
}
