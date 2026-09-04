const assert = require('assert')
const crypto = require('crypto')

const oddsJob = require('./netlify/functions/capture-match-odds-timeline.js')._test
const anomaly = require('./netlify/functions/match-ops-anomaly-scan.js')._test
const explorer = require('./netlify/functions/get-match-performance-explorer.js')._test
const replay = require('./netlify/functions/get-match-replay.js')._test

const now = Date.UTC(2026, 8, 4, 20, 0, 0)
assert.equal(oddsJob.dueWindow(new Date(now + 15 * 60000).toISOString(), now).key, 'T15M')
assert.equal(oddsJob.dueWindow(new Date(now + 60 * 60000).toISOString(), now).key, 'T1H')
assert.equal(oddsJob.dueWindow(new Date(now + 360 * 60000).toISOString(), now).key, 'T6H')
assert.equal(oddsJob.dueWindow(new Date(now + 1440 * 60000).toISOString(), now).key, 'T24H')
assert.equal(oddsJob.dueWindow(new Date(now + 180 * 60000).toISOString(), now), null)

const bad = anomaly.inspect({
  fixture_id: '123', fixture_date: 'bad-date', home_team: 'Same', away_team: 'Same',
  model_version: '', data_quality: 20, forecast: { xg: { home: 8.2, away: 1.1 }, oneXTwo: { home: 70, draw: 30, away: 30 }, goals: { over15: 150 } },
  settled_at: new Date().toISOString(), actual_home_goals: null, actual_away_goals: null
})
assert(bad.some(x => x.anomaly_type === 'invalid_team_identity'))
assert(bad.some(x => x.anomaly_type === 'invalid_fixture_date'))
assert(bad.some(x => x.anomaly_type === 'xg_outlier'))
assert(bad.some(x => x.anomaly_type === 'one_x_two_probability_sum'))
assert(bad.some(x => x.anomaly_type === 'settled_without_score'))

const row = { league: 'Premier League', model_version: 'BETAI_FORECAST_V200', data_quality: 90, fixture_date: '2026-09-01T18:00:00Z', forecast: { professionalLab: { decisionCard: { conservativeEdgePp: 7, conservativeProbability: 63, bookmakerOdds: 1.9 } } } }
assert(explorer.filterRow(row, { league: 'premier', min_quality: '80', min_edge: '5', min_confidence: '60', odds_min: '1.5', odds_max: '2.2' }))
assert(!explorer.filterRow(row, { min_edge: '8' }))

const forecast = { version: 'BETAI_FORECAST_V200', oneXTwo: { home: 50, draw: 25, away: 25 } }
const payload = { fixtureId:'123', fixtureDate:'2026-09-05T18:00:00Z', homeTeam:'A', awayTeam:'B', league:'League', country:'UK', forecast }
function stableStringify(value) { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}` }
const freeze_hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
const canonical_hash_v211 = crypto.createHash('sha256').update(stableStringify(payload)).digest('hex')
const freezeRow = { fixture_id:'123', fixture_date:payload.fixtureDate, home_team:'A', away_team:'B', league:'League', country:'UK', forecast, freeze_hash, canonical_hash_v211, captured_at:'2026-09-05T17:00:00Z', model_version:'BETAI_FORECAST_V200', active_model:'champion', data_quality:90 }
assert.equal(replay.verifyFreeze(freezeRow), true)
const compact = replay.compactFreeze(freezeRow)
assert.equal(compact.hashVerified, true)
assert.equal(compact.minutesBeforeKickoff, 60)

console.log('TEST_V211_OK')
