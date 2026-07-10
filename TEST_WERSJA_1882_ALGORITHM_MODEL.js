const assert = require('node:assert/strict')
const {
  interpolatePressureProbability,
  calculatePressureModel,
  expectedValue,
  chooseProbabilityBet,
  chooseValueBet
} = require('./netlify/functions/_lib/algorithm-model')

assert.equal(interpolatePressureProbability(24), 42.2)
assert.equal(interpolatePressureProbability(48), 46.3)
assert.equal(interpolatePressureProbability(36.1).toFixed(2), '44.22')

const spainBelgium = calculatePressureModel(
  { shotsFor: 17.2, cornersFor: 7.8, shotsAllowed: 5.8, cornersAllowed: 1.2 },
  { shotsFor: 21.2, cornersFor: 4.6, shotsAllowed: 10.6, cornersAllowed: 3.8 }
)
assert.equal(spainBelgium.totalPressure, 36.1)
assert.equal(spainBelgium.overProbability, 44.22)
assert.equal(spainBelgium.underProbability, 55.78)
assert.equal(expectedValue(55.78, 2).toFixed(4), '0.1156')

// Najważniejszy test wersji 1882: wysoki kurs na Over nie może już odwrócić typu.
const higherOddsOver = chooseProbabilityBet(spainBelgium, { over: 3.75, under: 1.8 })
assert.equal(higherOddsOver.market, 'under_2_5')
assert.equal(higherOddsOver.probability, 55.78)
assert.equal(higherOddsOver.odds, 1.8)

// Alias starszej funkcji ma tę samą nową logikę.
const aliasSelection = chooseValueBet(spainBelgium, { over: 3.75, under: 1.8 })
assert.equal(aliasSelection.market, 'under_2_5')

// Próg 51%: 50.8% nie tworzy zakładu.
const belowThreshold = chooseProbabilityBet(
  { overProbability: 49.2, underProbability: 50.8 },
  { over: 2.1, under: 1.9 },
  { minProbability: 51 }
)
assert.equal(belowThreshold.market, 'no_bet')
assert.equal(belowThreshold.reason, 'probability_below_threshold')

// V1884: brak kursu nie blokuje typu. Kurs może zostać dopisany w kolejnym skanie.
const missingSelectedOdds = chooseProbabilityBet(
  { overProbability: 44.8, underProbability: 55.2 },
  { over: 3.75, under: 0 },
  { minProbability: 51 }
)
assert.equal(missingSelectedOdds.market, 'under_2_5')
assert.equal(missingSelectedOdds.probability, 55.2)
assert.equal(missingSelectedOdds.odds, 0)
assert.equal(missingSelectedOdds.reason, 'higher_probability_missing_odds')

console.log('OK: WERSJA 1884 all-fixtures probability-first algorithm model')
