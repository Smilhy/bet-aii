const assert=require('assert')
const Module=require('module')
const originalLoad=Module._load
let scenario=null, perfCalls=0
function makeClient(){
  return { from(name){
    const b={name,op:'',payload:null,filters:{},
      select(){this.op='select';return this},
      eq(k,v){this.filters[k]=v;if(this.op==='update') return Promise.resolve({data:null,error:null});return this},
      maybeSingle(){
        if(name==='fm_ai_system_picks_v368') return Promise.resolve({data:scenario.existing||null,error:null})
        if(name==='match_value_scan_snapshots') return Promise.resolve({data:scenario.snapshot||null,error:null})
        return Promise.resolve({data:null,error:null})
      },
      update(x){this.op='update';this.payload=x;return this},
      insert(row){scenario.inserted=row;return {select(){return this},single(){return Promise.resolve({data:{id:'new1',fixture_id:row.fixture_id,market_key:row.market_key,decision:row.decision,odds:row.odds,published_at:new Date().toISOString()},error:null})}}}
    }
    return b
  }}
}
const performance={available:true,all:{markets:[{key:'over25',samples:140,brier:.12,calibration:[{range:'50-80',samples:90,actualAccuracy:70,calibrationGap:0}]}]},drift:{markets:[{key:'over25',status:'PENDING'}]},leagueTrust:[{name:'Eredivisie',markets:[{key:'over25',score:86}]}]}
Module._load=function(request,parent,isMain){
  if(request==='@supabase/supabase-js') return {createClient:()=>makeClient()}
  if(request==='./get-match-prediction-performance' && /record-fm-ai-system-pick\.js$/.test(parent?.filename||'')) return {handler:async()=>{perfCalls++;return{statusCode:200,body:JSON.stringify(performance)}}}
  return originalLoad.apply(this,arguments)
}
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test'
const rec=require('./netlify/functions/record-fm-ai-system-pick.js')
function rawSnapshot(dataQuality=95){return {fixture_id:'fx1',fixture_date:new Date(Date.now()+3600000).toISOString(),home_team:'PSV',away_team:'Sparta',league:'Eredivisie',country:'NL',payload:{fixtureDate:new Date(Date.now()+3600000).toISOString(),home:'PSV',away:'Sparta',league:'Eredivisie',dataQuality,modelAgreement:92,bookmakerCount:4,marketConsensus:{over25:{sources:4,agreement:92},under25:{sources:4,agreement:92}},candidates:[{key:'under25',probability:30,bookmakerOdds:4,noVigImplied:24,edgePp:6,expectedValuePct:20,bookmaker:'Book A'},{key:'over25',probability:70,bookmakerOdds:2,noVigImplied:48,edgePp:22,expectedValuePct:40,bookmaker:'Book B'}]}}}
;(async()=>{
  scenario={existing:{id:'old',fixture_id:'fx1',market_key:'under25',decision:'VALUE',odds:4,published_at:'2026-09-13T10:00:00Z'},snapshot:rawSnapshot(),inserted:null};perfCalls=0
  let r=await rec.handler({httpMethod:'POST',body:JSON.stringify({fixtureId:'fx1',marketKey:'over25',decision:'STRONG_VALUE'})});let body=JSON.parse(r.body)
  assert.equal(r.statusCode,200);assert(body.duplicate);assert.equal(body.frozen.market_key,'under25');assert.equal(perfCalls,0)

  scenario={existing:null,snapshot:rawSnapshot(),inserted:null};perfCalls=0
  r=await rec.handler({httpMethod:'POST',body:JSON.stringify({fixtureId:'fx1',marketKey:'under25',decision:'VALUE',odds:4,aiProbability:99,fairOdds:1.01,edgePp:70,expectedValuePct:300,reliabilityScore:100,dailyScore:100})});body=JSON.parse(r.body)
  assert.equal(r.statusCode,200);assert(body.recorded);assert.equal(scenario.inserted.market_key,'over25');assert.notEqual(scenario.inserted.ai_probability,99);assert.equal(scenario.inserted.odds,2);assert(['VALUE','STRONG_VALUE'].includes(scenario.inserted.decision));assert.equal(scenario.inserted.display_snapshot.serverAuthoritativeV403,true);assert.equal(scenario.inserted.display_snapshot.requestedMarketKey,'under25');assert.equal(perfCalls,1)

  scenario={existing:null,snapshot:rawSnapshot(50),inserted:null};perfCalls=0
  r=await rec.handler({httpMethod:'POST',body:JSON.stringify({fixtureId:'fx1',marketKey:'over25',decision:'STRONG_VALUE',odds:2,aiProbability:99})});body=JSON.parse(r.body)
  assert([200,409].includes(r.statusCode));assert.equal(scenario.inserted,null);assert(body.reason==='not_actionable'||/rejected|quality/i.test(body.error||''));assert.equal(perfCalls,1)
  console.log('V403 SERVER RECORD AUTHORITY: PASS')
})().catch(e=>{console.error(e);process.exit(1)})
