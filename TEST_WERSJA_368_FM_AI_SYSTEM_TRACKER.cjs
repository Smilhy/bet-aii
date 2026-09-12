const assert=require('assert')
const {settleMarket,summary}=require('./netlify/functions/_lib/fm-ai-system-tracker-v368')
assert.strictEqual(settleMarket('over25',2,1),true)
assert.strictEqual(settleMarket('under25',1,1),true)
assert.strictEqual(settleMarket('bttsYes',2,1),true)
assert.strictEqual(settleMarket('bttsNo',0,2),true)
assert.strictEqual(settleMarket('home',2,1),true)
assert.strictEqual(settleMarket('draw',1,1),true)
assert.strictEqual(settleMarket('away',0,2),true)
const rows=[
 {status:'win',odds:2,stake_pln:10,profit_pln:10,fixture_date:'2026-09-10T12:00:00Z'},
 {status:'loss',odds:2,stake_pln:10,profit_pln:-10,fixture_date:'2026-09-10T14:00:00Z'},
 {status:'win',odds:1.5,stake_pln:10,profit_pln:5,fixture_date:'2026-09-11T12:00:00Z'},
 {status:'pending',odds:2.1,stake_pln:10,profit_pln:0,fixture_date:'2026-09-12T12:00:00Z'}
]
const s=summary(rows)
assert.strictEqual(s.wins,2); assert.strictEqual(s.losses,1); assert.strictEqual(s.pending,1)
assert.strictEqual(s.profit,5); assert.strictEqual(s.stake,30)
assert.strictEqual(s.yieldPct,16.67); assert.strictEqual(s.hitRate,66.7)
console.log('TEST_WERSJA_368_FM_AI_SYSTEM_TRACKER: OK',s)
