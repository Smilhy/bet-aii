const history = require('./netlify/functions/_lib/ai-prediction-history')
const settlement = require('./netlify/functions/settle-ai-prediction-history')

const rows = [
  { status: 'won', kickoff: new Date().toISOString(), settled_at: new Date().toISOString(), profit_units: 1.2, best_odds: 2.2, confidence: 62 },
  { status: 'lost', kickoff: new Date().toISOString(), settled_at: new Date().toISOString(), profit_units: -1, best_odds: 1.9, confidence: 58 },
  { status: 'won', kickoff: new Date().toISOString(), settled_at: new Date().toISOString(), profit_units: 0.8, best_odds: 1.8, confidence: 66 }
]
const stats = history.computeWindow(rows)
if (stats.settled !== 3 || stats.wins !== 2 || stats.losses !== 1) throw new Error('Nieprawidłowe W/L')
if (Math.abs(stats.accuracy - 66.67) > 0.01) throw new Error(`Nieprawidłowa skuteczność: ${stats.accuracy}`)
if (Math.abs(stats.profit_units - 1) > 0.01) throw new Error(`Nieprawidłowy zysk: ${stats.profit_units}`)

const fixture = {
  fixture: { status: { short: 'AET' } },
  goals: { home: 3, away: 2 },
  score: { fulltime: { home: 2, away: 2 } }
}
const patch = settlement._test.settlementFor({ pick_key: 'draw', best_odds: 3.4 }, fixture)
if (patch.status !== 'won') throw new Error('AET musi używać wyniku po 90 minutach')
if (patch.home_score !== 2 || patch.away_score !== 2) throw new Error('Nieprawidłowy wynik regular time')

const snapshot = history.serializePrediction({
  id: 123,
  kickoff: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  status: 'upcoming',
  country: 'Poland',
  league: 'Test',
  home: { name: 'Alpha' },
  away: { name: 'Beta' },
  pick_key: 'home',
  pick_label: 'Alpha',
  confidence: 61,
  true_odds: 1.64,
  best_odds: 1.9,
  edge: 15.9,
  outcomes: []
})
if (!snapshot || snapshot.fixture_id !== '123' || snapshot.status !== 'pending') throw new Error('Nie zapisano snapshotu')

console.log('WERSJA 13 AI Prediction stats: test OK', stats)
