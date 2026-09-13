const assert = require('assert')
const fs = require('fs')
const path = require('path')
const mod = require('./netlify/functions/_lib/ai-bot-cycle.js')
const t = mod._test
let passed = 0
function test(name, fn){
  try { fn(); passed++; console.log('PASS', name) }
  catch (e) { console.error('FAIL', name, e.message); process.exitCode = 1 }
}

const event = { fixtureId:'1', home:'Home FC', away:'Away FC', league:'Test League', country:'UK', kickoff:new Date(Date.now()+3600000).toISOString(), matchDate:'2026-09-14' }

test('V408 source/version enabled', () => {
  assert.equal(mod.AUTHORS.betai.source, 'betai_strict_value_v408')
  assert.ok(String(mod.VERSION).startsWith('408.0'))
})

test('double chance parser', () => {
  const g=t.parseMarketsV408('Double Chance',[{value:'Home/Draw',odd:'1.40'},{value:'Draw/Away',odd:'1.60'},{value:'Home/Away',odd:'1.30'}])[0]
  assert.equal(g.marketKey,'double_chance'); assert.equal(g.outcomes.one_x,1.4); assert.equal(g.outcomes.x_two,1.6); assert.equal(g.outcomes.one_two,1.3)
})

test('totals parser splits 1.5/2.5/3.5', () => {
  const gs=t.parseMarketsV408('Goals Over/Under',[
    {value:'Over 1.5',odd:'1.30'},{value:'Under 1.5',odd:'3.40'},
    {value:'Over 2.5',odd:'1.80'},{value:'Under 2.5',odd:'2.00'},
    {value:'Over 3.5',odd:'2.70'},{value:'Under 3.5',odd:'1.45'}])
  assert.deepEqual(gs.map(x=>x.marketKey).sort(),['goals_1_5','goals_2_5','goals_3_5'])
})

test('strict policy has quality gates', () => {
  const p=mod.BOT_POLICIES.betai
  assert.equal(p.strictOnly,true); assert.equal(p.minBooks,3); assert.equal(p.minProbability,52); assert.equal(p.minEdge,3); assert.equal(p.maxSpread,8); assert.equal(p.requireApiEvidence,true)
})

const good={event,marketKey:'double_chance',selectionKey:'x_two',market:'Podwójna szansa',prediction:'X2',odds:1.80,probability:62,marketProbability:62,implied:55.56,edge:11.6,booksCount:5,spread:2,quality:80,apiEvidence:{supported:true,contrary:false,available:true}}

test('strict candidate passes',()=>assert.equal(t.candidateTier(good,mod.BOT_POLICIES.betai),'strict'))
test('one bookmaker rejected',()=>assert.equal(t.candidateTier({...good,booksCount:1},mod.BOT_POLICIES.betai),''))
test('low probability rejected',()=>assert.equal(t.candidateTier({...good,probability:51},mod.BOT_POLICIES.betai),''))
test('low edge rejected',()=>assert.equal(t.candidateTier({...good,edge:2.9},mod.BOT_POLICIES.betai),''))
test('wide spread rejected',()=>assert.equal(t.candidateTier({...good,spread:8.1},mod.BOT_POLICIES.betai),''))
test('low quality rejected',()=>assert.equal(t.candidateTier({...good,quality:67},mod.BOT_POLICIES.betai),''))
test('odds above max rejected',()=>assert.equal(t.candidateTier({...good,odds:3.21},mod.BOT_POLICIES.betai),''))
test('API confirmation required',()=>assert.equal(t.apiStrategyPass({...good,apiEvidence:{supported:false,unavailable:true}},'betai',mod.BOT_POLICIES.betai),false))
test('API contrary rejected',()=>assert.equal(t.apiStrategyPass({...good,apiEvidence:{supported:false,contrary:true,available:true}},'betai',mod.BOT_POLICIES.betai),false))
test('confirmed candidate publishable',()=>assert.equal(t.apiStrategyPass(good,'betai',mod.BOT_POLICIES.betai),true))

test('1X2 API probability extracted',()=>{
  const ev=t.predictionSupport({...good,marketKey:'match_winner',selectionKey:'away'}, {predictions:{winner:{name:'Away FC'},percent:{home:'38%',draw:'25%',away:'37%'}}})
  assert.equal(ev.supported,true); assert.equal(ev.probability,37)
})

test('X2 API probability sums draw+away',()=>{
  const ev=t.predictionSupport(good, {predictions:{winner:{name:'Home FC'},percent:{home:'39.1%',draw:'26.3%',away:'34.6%'}}})
  assert.ok(Math.abs(ev.probability-60.9)<0.01); assert.equal(ev.supported,true)
})

test('recalibration blends independent API probability',()=>{
  const c={...good,marketProbability:58,probability:58,odds:1.85,apiEvidence:{supported:true,contrary:false,available:true,probability:66}}
  t.recalibrateCandidateV408(c)
  assert.ok(c.probability>58 && c.probability<66); assert.ok(c.edge>3); assert.ok(c.apiProbability===66)
})

test('buildCandidates derives double chance probability from no-vig 1X2',()=>{
  const groups=[]
  for (const n of [1,2,3]) {
    groups.push({bookmaker:'B'+n,marketKey:'match_winner',outcomes:{home:2.40,draw:3.20,away:3.00}})
    groups.push({bookmaker:'B'+n,marketKey:'double_chance',outcomes:{one_x:1.42,x_two:1.72,one_two:1.35}})
  }
  const out=t.buildCandidates([event],new Map([['1',groups]]),{minBooks:3,minOdds:1.2,maxOdds:5,minProbability:0.08})
  const x2=out.find(c=>c.selectionKey==='x_two')
  assert.ok(x2 && x2.booksCount===3)
  // no-vig 1X2: draw + away powinno być około 57%, a nie sztuczny udział z sumy kursów DC.
  assert.ok(x2.marketProbability > 54 && x2.marketProbability < 61)
})

test('buildCandidates rejects when only two books and minBooks=3',()=>{
  const groups=[]
  for (const n of [1,2]) {
    groups.push({bookmaker:'B'+n,marketKey:'match_winner',outcomes:{home:2.40,draw:3.20,away:3.00}})
    groups.push({bookmaker:'B'+n,marketKey:'double_chance',outcomes:{one_x:1.42,x_two:1.72,one_two:1.35}})
  }
  const out=t.buildCandidates([event],new Map([['1',groups]]),{minBooks:3,minOdds:1.2,maxOdds:5,minProbability:0.08})
  assert.equal(out.length,0)
})

test('labels support X2 and totals 3.5',()=>{
  assert.equal(t.labelFor(event,'double_chance','x_two').prediction,'X2')
  assert.equal(t.labelFor(event,'goals_3_5','under_3_5').prediction,'Poniżej 3.5 gola')
})

test('frontend disables daily force and uses correct parameter names',()=>{
  const s=fs.readFileSync(path.join(__dirname,'src/main.jsx'),'utf8')
  const start=s.indexOf('async function runSavedAiScanEndpointV1690')
  const end=s.indexOf('async function fetchLiveAiPicks',start)
  const block=s.slice(start,end)
  assert.ok(block.includes("betai_min_probability_pct: '52'"))
  assert.ok(block.includes("betai_min_edge_pct: '3'"))
  assert.ok(!block.includes("daily_force: '1'"))
  assert.ok(!block.includes("force_daily: '1'"))
})

test('frontend strict path refuses local/hash fallback on endpoint failure',()=>{
  const s=fs.readFileSync(path.join(__dirname,'src/main.jsx'),'utf8')
  assert.ok(s.includes('local/hash fallback disabled'))
  assert.ok(s.includes('Nie tworzę sztucznego ani lokalnego typu'))
})

test('active picks are source-isolated to V408',()=>{
  const s=fs.readFileSync(path.join(__dirname,'src/main.jsx'),'utf8')
  assert.ok(s.includes("params.set('source', BETAI_AI_ENGINE_SOURCE_V408)"))
  assert.ok(s.includes(".eq('source', BETAI_AI_ENGINE_SOURCE_V408)"))
})

test('V408 display preserves raw server probability/EV (no hash normalization)',()=>{
  const s=fs.readFileSync(path.join(__dirname,'src/main.jsx'),'utf8')
  assert.ok(s.includes('const isStrictV408 ='))
  assert.ok(s.includes("confidenceText = aiScore >= 84"))
})

test('settlement recognizes V408 source',()=>{
  const s=fs.readFileSync(path.join(__dirname,'netlify/functions/settle-live-ai-picks.js'),'utf8')
  assert.ok(s.includes("'betaistrictvalue'"))
})

test('mirror lookup isolates by source/version',()=>{
  const s=fs.readFileSync(path.join(__dirname,'netlify/functions/_lib/ai-bot-cycle.js'),'utf8')
  assert.ok(s.includes(".eq('source', row.source).limit(1)"))
})

test('V408 KPI/statistics are separated from legacy history',()=>{
  const s=fs.readFileSync(path.join(__dirname,'src/main.jsx'),'utf8')
  assert.ok(s.includes("statsCards = resultCards.filter(card => String(card?.source || '').toLowerCase().includes('betai_strict_value_v408'))"))
  assert.ok(s.includes('V408 od teraz'))
  assert.ok(s.includes("setEngineScopeV408('history')"))
})

test('get-ai-bets supports exact source filtering',()=>{
  const s=fs.readFileSync(path.join(__dirname,'netlify/functions/get-ai-bets.js'),'utf8')
  assert.ok(s.includes("if (params.source) query = query.eq('source', String(params.source))"))
})

console.log(`V408 tests: ${passed} passed`)
if (process.exitCode) process.exit(process.exitCode)
