const predictionModule = require('./netlify/functions/get-ai-predictions.js')

const oddsMap = predictionModule._test.buildOddsMap([{
  fixture: { id: 123456 },
  bookmakers: [
    { name: 'Book A', bets: [{ name: 'Match Winner', values: [
      { value: 'Home', odd: '2.00' }, { value: 'Draw', odd: '3.40' }, { value: 'Away', odd: '3.70' }
    ] }] },
    { name: 'Book B', bets: [{ name: 'Match Winner', values: [
      { value: 'Home', odd: '2.10' }, { value: 'Draw', odd: '3.25' }, { value: 'Away', odd: '3.60' }
    ] }] }
  ]
}])

const fixture = {
  fixture: {
    id: 123456,
    date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: { short: 'NS' },
    venue: { name: 'Test Arena' }
  },
  teams: { home: { name: 'Alpha' }, away: { name: 'Beta' } },
  league: { name: 'Test League', country: 'Poland', round: 'Round 1' },
  goals: { home: null, away: null }
}

const apiPrediction = {
  predictions: {
    percent: { home: '55%', draw: '25%', away: '20%' },
    advice: 'Alpha or draw',
    goals: { home: '1.8', away: '0.9' }
  },
  comparison: {
    form: { home: '60%', away: '40%' },
    att: { home: '65%', away: '35%' },
    def: { home: '55%', away: '45%' }
  }
}

const row = predictionModule._test.buildPredictionRow(fixture, oddsMap.get('123456'), apiPrediction)
if (!row) throw new Error('Brak wygenerowanego rekordu')
if (row.pick_key !== 'home') throw new Error(`Nieprawidłowy wybór: ${row.pick_key}`)
if (!Array.isArray(row.outcomes) || row.outcomes.length !== 3) throw new Error('Brak pełnego rynku 1X2')
if (!(row.confidence > 0 && row.true_odds > 1)) throw new Error('Nieprawidłowa pewność lub kurs fair')

console.log('WERSJA 11 AI Prediction: test OK', {
  pick: row.pick_label,
  confidence: row.confidence,
  trueOdds: row.true_odds,
  valueBets: row.value_bets
})
