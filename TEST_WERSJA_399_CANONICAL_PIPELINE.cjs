const fs = require('fs')
const assert = (cond,msg)=>{ if(!cond){ throw new Error(msg) } }
const read = f => fs.readFileSync(f,'utf8')
const daily = read('src/MatchSimulatorDailyMatchesView.jsx')
const prep = read('src/MatchSimulatorPreparationView.jsx')
const flow = read('src/MatchSimulatorFlowView.jsx')
const view = read('src/MatchSimulatorView.jsx')
const engine = read('src/matchEngineV320.js')
const pro = read('src/FmAiProMarketSuiteV377.jsx')
const save = read('netlify/functions/save-match-prediction.js')
const record = read('netlify/functions/record-fm-ai-system-pick.js')
const settle = require('./netlify/functions/_lib/fm-ai-system-tracker-v368.js')

const checks = [
  [pro.includes("entry?.scan?.topFinal"), 'board reads scan.topFinal'],
  [daily.includes('fmAiSnapshotV365: sharedSnapshotV367'), 'selected match carries frozen snapshot'],
  [daily.includes('topPick: dailyScan.topFinal ?'), 'snapshot is built from dailyScan.topFinal'],
  [prep.includes('CANONICAL PIPELINE'), 'preparation has V399 canonical pipeline'],
  [prep.includes('top3: [canonicalTopV399'), 'canonical market is forced to value.top3[0]'],
  [prep.includes('top: canonicalTopV399'), 'canonical market is forced to value.top'],
  [prep.includes('professionalLab: professionalLab || null'), 'professional lab is embedded in prepared forecast'],
  [flow.includes('setPreparedData(data || null)'), 'flow stores prepared data'],
  [flow.includes('preparedData={preparedData}'), 'flow passes same prepared data into LIVE'],
  [view.includes('data?.predictionEngine?.sharedSnapshotV365?.topPick'), 'LIVE reads same frozen snapshot'],
  [engine.includes('data?.predictionEngine?.sharedSnapshotV365?.topPick'), 'match engine reads same frozen snapshot'],
  [view.includes('TRAFIONY W TEJ SYMULACJI') && view.includes('NIETRAFIONY W TEJ SYMULACJI'), 'LIVE labels simulated hit/miss'],
  [view.includes('sharedHardGuardV367 = false'), 'visual model does not force result'],
  [engine.includes('sharedHardGuardV367 = false'), 'match engine does not force result'],
  [record.includes("if (!['VALUE','STRONG_VALUE'].includes(decision))"), 'tracker records actionable signals only'],
  [save.includes("forecast?.professionalLab?.decisionCard?.key || forecast?.value?.top?.key"), 'saved prediction uses prepared canonical decision/value market'],
]
for(const [ok,msg] of checks){ assert(ok,msg); console.log('PASS',msg) }

const settlementCases = [
  ['under25',2,0,true],['under25',4,0,false],['over25',2,1,true],['under35',3,0,true],['under35',4,0,false],['bttsYes',2,1,true],['bttsYes',2,0,false],['bttsNo',2,0,true],['home',1,0,true],['away',0,1,true],['draw',1,1,true]
]
for(const [key,h,a,want] of settlementCases){ const got=settle.settleMarket(key,h,a); assert(got===want,`settle ${key} ${h}:${a}`); console.log('PASS settlement',key,`${h}:${a}`,got) }
console.log(`\nV399 CANONICAL PIPELINE: ${checks.length + settlementCases.length}/${checks.length + settlementCases.length} PASS`)
