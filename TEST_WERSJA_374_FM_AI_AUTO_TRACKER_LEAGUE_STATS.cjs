const assert=require('assert')
const {classify,enrichScan}=require('./netlify/functions/_lib/fm-ai-value-policy-v374')
const {leagueDetails}=require('./netlify/functions/get-fm-ai-system-stats')._test

const performance={
  all:{markets:[{key:'over25',samples:120,brier:.20,calibration:[{range:'60-65%',samples:30,actualAccuracy:63,calibrationGap:1}]}]},
  leagues:[],drift:{markets:[{key:'over25',status:'STABLE'}]},leagueTrust:[]
}
const scan={league:'Serie A',dataQuality:92,modelAgreement:80,bookmakerCount:4,candidates:[{key:'over25',probability:62,noVigImplied:52,bookmakerOdds:2.0,edgePp:10,expectedValuePct:24,marketConsensus:{sources:4,agreement:82}}]}
const enriched=enrichScan(scan,performance)
assert(['VALUE','STRONG_VALUE'].includes(enriched.topFinal.decision),'qualified candidate should be actionable')

const rows=[
 {id:1,league:'Serie A',market_key:'over25',market_label:'Powyżej 2.5 gola',status:'win',stake_pln:10,profit_pln:10,odds:2,fixture_date:'2026-09-12T18:00:00Z',home_team:'A',away_team:'B',ai_probability:62,decision:'VALUE',actual_home_goals:2,actual_away_goals:1},
 {id:2,league:'Serie A',market_key:'under35',market_label:'Poniżej 3.5 gola',status:'loss',stake_pln:10,profit_pln:-10,odds:1.8,fixture_date:'2026-09-12T20:00:00Z',home_team:'C',away_team:'D',ai_probability:70,decision:'VALUE',actual_home_goals:3,actual_away_goals:2},
 {id:3,league:'Serie A',market_key:'over25',market_label:'Powyżej 2.5 gola',status:'pending',stake_pln:10,profit_pln:0,odds:2.1,fixture_date:'2026-09-13T18:00:00Z',home_team:'E',away_team:'F',ai_probability:61,decision:'VALUE'}
]
const detail=leagueDetails(rows)[0]
assert.equal(detail.name,'Serie A')
assert.equal(detail.picks,3)
assert.equal(detail.resolved,2)
assert.equal(detail.markets.length,2)
assert.equal(detail.recent.length,3)
console.log('V374 tests OK', {decision:enriched.topFinal.decision, league:detail.name, markets:detail.markets.map(x=>x.key)})
