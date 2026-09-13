const assert = require('assert')
const fs = require('fs')
const Module = require('module')
const originalLoad = Module._load
Module._load = function patched(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => null }
  return originalLoad.apply(this, arguments)
}

const mod = require('./netlify/functions/get-fm-ai-system-stats.js')._test
const base = (id, league, market_key, market_label, status, profit, odds=2) => ({
  id, league, market_key, market_label, status, profit_pln: profit, stake_pln: 10,
  odds, fixture_date: `2026-09-${String((id%9)+1).padStart(2,'0')}T12:00:00Z`
})
const rows = []
for (let i=1;i<=6;i++) rows.push(base(i,'Serie A','over25','Powyżej 2.5 gola',i<=4?'win':'loss',i<=4?10:-10,2))
for (let i=7;i<=12;i++) rows.push(base(i,'La Liga','under35','Poniżej 3.5 gola',i===7?'win':'loss',i===7?3.3:-10,1.33))
rows.push(base(13,'Serie A','bttsYes','Obie drużyny strzelą','pending',0,1.9))

const lab = mod.leagueMarketSegments(rows)
assert.strictEqual(lab.all.length, 3)
assert.strictEqual(lab.top[0].league, 'Serie A')
assert.strictEqual(lab.top[0].marketKey, 'over25')
assert.strictEqual(lab.watch[0].league, 'La Liga')
assert.strictEqual(mod.sampleLabel(4), 'LOW_SAMPLE')
assert.strictEqual(mod.sampleLabel(10), 'EARLY_SIGNAL')
assert.strictEqual(mod.sampleLabel(30), 'VALIDATING')
assert.strictEqual(mod.sampleLabel(100), 'STRONG_SAMPLE')

const daily = fs.readFileSync('src/MatchSimulatorDailyMatchesView.jsx','utf8')
for (const marker of ['SEGMENT LAB — LIGA × RYNEK','LEAGUE × MARKET SEGMENT LAB','trackerSampleLabelV375','systemStatsV368.segmentLab']) {
  assert(daily.includes(marker), `Missing V375 marker: ${marker}`)
}
// These were already present before V375 and must remain the single existing validation layers.
for (const existing of ['MODEL HEALTH + CLV + PERFORMANCE','PEŁNY PERFORMANCE BREAKDOWN — kurs / confidence / edge','CLV TRACKER']) {
  assert(daily.includes(existing), `Existing validation feature disappeared: ${existing}`)
}
console.log('TEST_WERSJA_375_FM_AI_SEGMENT_VALIDATION_LAB: OK')
