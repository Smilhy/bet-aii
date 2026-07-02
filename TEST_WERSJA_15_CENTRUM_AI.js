const assert = require('assert')
const center = require('./netlify/functions/ai-control-center')._test
const monitor = require('./netlify/functions/_lib/ai-system-monitor')

const now = new Date('2026-07-02T10:10:00.000Z')
assert.strictEqual(center.nextHourly(17, now), '2026-07-02T10:17:00.000Z')
assert.strictEqual(center.nextHourly(5, now), '2026-07-02T11:05:00.000Z')
assert.strictEqual(center.nextEveryTwoHours(12, now), '2026-07-02T10:12:00.000Z')
assert.strictEqual(center.nextEveryTwoHours(7, now), '2026-07-02T12:07:00.000Z')
assert.strictEqual(center.fixtureIdOf({ fixture_id: null, api_fixture_id: 1519379 }), '1519379')
assert.strictEqual(center.statusOf({ status: 'won', settlement_status: null }), 'won')

const healthy = center.evaluateSystem(
  { key: 'betai', name: 'BetAI', publishMinute: 7, settlementMinute: 17 },
  { total_pending: 0, missing_fixture_id: 0, oldest_pending: null, latest_items: [] },
  { status: 'success', finished_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { status: 'success', finished_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { ok: true },
  { supabase: true, service_role: true, api_key: true }
)
assert.strictEqual(healthy.status, 'ok')

const broken = center.evaluateSystem(
  { key: 'typer', name: 'Typer', publishMinute: 27, settlementMinute: 37 },
  { total_pending: 2, missing_fixture_id: 1, oldest_pending: { match: 'A – B', kickoff: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }, latest_items: [] },
  { status: 'success', finished_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { status: 'success', finished_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { ok: true },
  { supabase: true, service_role: true, api_key: true }
)
assert.strictEqual(broken.status, 'error')
assert.ok(broken.alerts.some(item => item.text.includes('fixture_id')))

const summary = monitor.summarize({ checked: 12, candidates_found: 4, inserted: 1, settled: [{ id: 1 }], api_calls: 3, api_remaining: 80 })
assert.deepStrictEqual({ checked: summary.checked, candidates: summary.candidates, created: summary.created, settled: summary.settled, apiCalls: summary.apiCalls, apiRemaining: summary.apiRemaining }, { checked: 12, candidates: 4, created: 1, settled: 1, apiCalls: 3, apiRemaining: 80 })

console.log('WERSJA 15 Centrum AI: testy OK')
