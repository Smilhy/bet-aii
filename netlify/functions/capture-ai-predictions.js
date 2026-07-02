const predictionsFunction = require('./get-ai-predictions')

exports.handler = async function handler() {
  // Osobny scheduler uruchamia generator również wtedy, gdy nikt nie otwiera strony.
  // Dzięki temu każda przedmeczowa predykcja trafia do historii i może później
  // zostać rozliczona oraz policzona w statystykach.
  return predictionsFunction.handler({
    queryStringParameters: {
      hours: '18',
      limit: '60',
      deep_limit: '12',
      scheduled_capture: '1'
    }
  })
}

// WERSJA 15 — realny dziennik uruchomień dla Centrum AI.
const { monitorHandler: monitorPredictionCaptureV15 } = require('./_lib/ai-system-monitor')
exports.handler = monitorPredictionCaptureV15({ systemKey: 'predictions', runType: 'capture' }, exports.handler)
