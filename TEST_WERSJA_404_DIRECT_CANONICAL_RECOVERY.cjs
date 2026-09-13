const assert=require('assert')
const fs=require('fs')
const Module=require('module')
const originalLoad=Module._load
let scenario=null, perfCalls=0
function makeClient(){
  return { from(name){
    const b={name,op:'',payload:null,filters:{},
      select(){this.op='select';return this},
      eq(k,v){this.filters[k]=v;if(this.op==='update')return Promise.resolve({data:null,error:null});return this},
      maybeSingle(){
        if(name==='fm_ai_system_picks_v368')return Promise.resolve({data:scenario.existing||null,error:null})
        if(name==='match_value_scan_snapshots')return Promise.resolve({data:scenario.snapshot||null,error:null})
        return Promise.resolve({data:null,error:null})
      },
      update(x){this.op='update';this.payload=x;return this},
      insert(row){scenario.inserted=row;return {select(){return this},single(){const out={...row,id:'new-v404',published_at:new Date().toISOString()};return Promise.resolve({data:out,error:null})}}}
    }
    return b
  }}
}
const performance={available:true,all:{markets:[{key:'over25',samples:140,brier:.12,calibration:[{range:'50-80',samples:90,actualAccuracy:70,calibrationGap:0}]}]},drift:{markets:[{key:'over25',status:'PENDING'}]},leagueTrust:[{name:'Eredivisie',markets:[{key:'over25',score:86}]}]}
Module._load=function(request,parent,isMain){
  if(request==='@supabase/supabase-js')return{createClient:()=>makeClient()}
  if(request==='./get-match-prediction-performance'&&/record-fm-ai-system-pick\.js$/.test(parent?.filename||''))return{handler:async()=>{perfCalls++;return{statusCode:200,body:JSON.stringify(performance)}}}
  return originalLoad.apply(this,arguments)
}
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test'
const rec=require('./netlify/functions/record-fm-ai-system-pick.js')
function existingRow(){return{id:'old',fixture_id:'fx1',fixture_date:new Date(Date.now()+3600000).toISOString(),market_key:'under25',market_label:'Poniżej 2.5 gola',decision:'VALUE',odds:4.25,ai_probability:31.2,fair_odds:3.21,edge_pp:7.7,expected_value_pct:32.6,reliability_score:81,daily_score:73,published_at:'2026-09-13T10:00:00Z',display_snapshot:{bookmaker:'Book A',noVigImplied:23.5,rawImplied:24.1,bookmakerMargin:4.4,threshold:6.5,marketGroup:'goals'}}}
function rawSnapshot(dataQuality=95){const fd=new Date(Date.now()+3600000).toISOString();return{fixture_id:'fx2',fixture_date:fd,home_team:'PSV',away_team:'Sparta',league:'Eredivisie',country:'NL',payload:{fixtureDate:fd,home:'PSV',away:'Sparta',league:'Eredivisie',dataQuality,modelAgreement:92,bookmakerCount:4,marketConsensus:{over25:{sources:4,agreement:92},under25:{sources:4,agreement:92}},candidates:[{key:'under25',probability:30,bookmakerOdds:4,noVigImplied:24,edgePp:6,expectedValuePct:20,bookmaker:'Book A'},{key:'over25',probability:70,bookmakerOdds:2,noVigImplied:48,edgePp:22,expectedValuePct:40,bookmaker:'Book B'}]}}}
;(async()=>{
  // 1) Existing frozen record must recover even with NO_BET and no market in request.
  scenario={existing:existingRow(),snapshot:null,inserted:null};perfCalls=0
  let r=await rec.handler({httpMethod:'POST',body:JSON.stringify({fixtureId:'fx1',decision:'NO_BET'})});let body=JSON.parse(r.body)
  assert.equal(r.statusCode,200);assert.equal(body.duplicate,true);assert.equal(body.directRecoveryV404,true);assert.equal(body.canonicalFrozenV404.key,'under25');assert.equal(body.canonicalFrozenV404.probability,31.2);assert.equal(body.canonicalFrozenV404.odds,4.25);assert.equal(body.canonicalFrozenV404.bookmaker,'Book A');assert.equal(perfCalls,0)

  // 2) No existing record + stale client NO_BET must NOT suppress an actionable server canonical pick.
  scenario={existing:null,snapshot:rawSnapshot(),inserted:null};perfCalls=0
  r=await rec.handler({httpMethod:'POST',body:JSON.stringify({fixtureId:'fx2',marketKey:'under25',decision:'NO_BET'})});body=JSON.parse(r.body)
  assert.equal(r.statusCode,200);assert.equal(body.recorded,true);assert.equal(body.serverAuthorityV404,true);assert.equal(body.canonicalFrozenV404.key,'over25');assert.equal(scenario.inserted.market_key,'over25');assert.equal(perfCalls,1)

  // 3) Client handshake must call authoritative recorder before the non-actionable exit.
  const daily=fs.readFileSync('./src/MatchSimulatorDailyMatchesView.jsx','utf8')
  const start=daily.indexOf('const ensureCanonicalTrackerFreezeV402')
  const fetchIdx=daily.indexOf("fetch('/.netlify/functions/record-fm-ai-system-pick'",start)
  const canonicalIdx=daily.indexOf('payload?.canonicalFrozenV404?.fixtureId',start)
  const noActionIdx=daily.indexOf('if (!actionableV403) return dailyScan',start)
  assert(start>=0&&fetchIdx>start&&canonicalIdx>fetchIdx&&noActionIdx>canonicalIdx,'V404 direct recovery must precede current NO_BET exit')

  // 4) Board refreshes canonical tracker state while visible and on focus.
  assert(daily.includes('window.setInterval(tickV404, 45000)'))
  assert(daily.includes("window.addEventListener('focus', onFocusV404)"))

  console.log('V404 DIRECT CANONICAL RECOVERY: 4 groups PASS')
})().catch(e=>{console.error(e);process.exit(1)})
