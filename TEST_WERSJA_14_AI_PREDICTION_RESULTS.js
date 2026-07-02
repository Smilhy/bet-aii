const assert = require('node:assert/strict')
const history = require('./netlify/functions/_lib/ai-prediction-history')
const historyEndpoint = require('./netlify/functions/get-ai-prediction-history')
const settlement = require('./netlify/functions/settle-ai-prediction-history')

const rows = [
  { status: 'won', settled_at: new Date().toISOString(), kickoff: new Date().toISOString(), profit_units: 1.2, best_odds: 2.2, confidence: 61 },
  { status: 'lost', settled_at: new Date().toISOString(), kickoff: new Date().toISOString(), profit_units: -1, best_odds: 1.8, confidence: 55 },
  { status: 'void', settled_at: new Date().toISOString(), kickoff: new Date().toISOString(), profit_units: 0, best_odds: 2, confidence: 50 }
]
const stats = history.computeWindow(rows)
assert.equal(stats.settled, 2)
assert.equal(stats.wins, 1)
assert.equal(stats.losses, 1)
assert.equal(stats.voids, 1)
assert.equal(stats.accuracy, 50)
assert.equal(stats.profit_units, 0.2)
assert.equal(stats.roi, 10)

assert.equal(historyEndpoint._test.normalizeStatus('won'), 'won')
assert.equal(historyEndpoint._test.normalizeStatus('bad'), 'all')
assert.equal(historyEndpoint._test.clampInteger('500', 50, 1, 100), 100)

const fixture = {
  fixture: { status: { short: 'FT' } },
  goals: { home: 2, away: 1 },
  score: { fulltime: { home: 2, away: 1 } }
}
const result = settlement._test.settlementFor({ pick_key: 'home', best_odds: 2.1 }, fixture)
assert.equal(result.status, 'won')
assert.equal(result.profit_units, 1.1)

console.log('OK WERSJA 14: statystyki, historia i rozliczanie')
