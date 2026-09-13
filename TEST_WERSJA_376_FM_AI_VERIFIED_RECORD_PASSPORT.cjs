const assert = require('assert')
const fs = require('fs')
const Module = require('module')
const originalLoad = Module._load
Module._load = function patched(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => null }
  return originalLoad.apply(this, arguments)
}

const mod = require('./netlify/functions/get-fm-ai-system-stats.js')._test
const row = {
  id: 77,
  fixture_id: '123456',
  fixture_date: '2026-09-13T20:00:00Z',
  published_at: '2026-09-13T12:00:00Z',
  home_team: 'Alpha FC', away_team: 'Beta FC', league: 'Premier League', country: 'England',
  market_key: 'over25', market_label: 'Over 2.5', decision: 'VALUE', odds: 2.1,
  ai_probability: 56.4, fair_odds: 1.77, edge_pp: 8.8, expected_value_pct: 18.4,
  reliability_score: 81, daily_score: 77, stake_pln: 10, status: 'win',
  actual_home_goals: 2, actual_away_goals: 1, profit_pln: 11,
  model_version: 'V376', settled_at: '2026-09-13T22:00:00Z', settlement_source: 'api-football'
}
const built = mod.recordRowV376(row)
assert.strictEqual(built.fixtureId, '123456')
assert.strictEqual(built.frozenPreMatch, true)
assert.strictEqual(built.fairOdds, 1.77)
assert.strictEqual(built.expectedValuePct, 18.4)
assert.strictEqual(built.score, '2:1')
const integrity = mod.verifiedIntegrityV376([row, {...row,id:78,fixture_id:'2',published_at:'2026-09-13T21:00:00Z'}])
assert.strictEqual(integrity.total, 2)
assert.strictEqual(integrity.frozenPreMatch, 1)
assert.strictEqual(integrity.lateOrInvalid, 1)
assert.strictEqual(integrity.coveragePct, 50)

const daily = fs.readFileSync('src/MatchSimulatorDailyMatchesView.jsx','utf8')
for (const marker of ['VERIFIED RECORD + PREDICTION PASSPORT','ZWERYFIKOWANY REJESTR + PASZPORT TYPU','PREDICTION PASSPORT','systemHistoryStatusV376','predictionPassportV376']) {
  assert(daily.includes(marker), `Missing V376 marker: ${marker}`)
}
const css = fs.readFileSync('src/styles.css','utf8')
for (const marker of ['sim-v376-verified-record','sim-v376-passport-backdrop','sim-v376-record-row']) {
  assert(css.includes(marker), `Missing V376 CSS marker: ${marker}`)
}
console.log('TEST_WERSJA_376_FM_AI_VERIFIED_RECORD_PASSPORT: OK')
