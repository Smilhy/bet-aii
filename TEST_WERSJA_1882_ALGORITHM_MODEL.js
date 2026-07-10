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

// Wysoki kurs po przeciwnej stronie nie może odwrócić kierunku modelu.
const probabilityFirst = chooseProbabilityBet(spainBelgium, { over: 3.75, under: 2.12 })
assert.equal(probabilityFirst.market, 'under_2_5')
assert.equal(probabilityFirst.probability, 55.78)
assert.equal(probabilityFirst.odds, 2.12)
assert.equal(probabilityFirst.reason, 'higher_probability_min_odds')

// Alias starszej funkcji ma tę samą logikę.
const aliasSelection = chooseValueBet(spainBelgium, { over: 3.75, under: 2.12 })
assert.equal(aliasSelection.market, 'under_2_5')

// Próg 51%: 50.8% nie tworzy zakładu nawet przy dobrym kursie.
const belowProbability = chooseProbabilityBet(
  { overProbability: 49.2, underProbability: 50.8 },
  { over: 2.2, under: 2.1 },
  { minProbability: 51, minOdds: 2 }
)
assert.equal(belowProbability.market, 'no_bet')
assert.equal(belowProbability.reason, 'probability_below_threshold')

// Brak kursu blokuje zakład, ale nie zmienia obliczonego prawdopodobieństwa.
const missingSelectedOdds = chooseProbabilityBet(
  { overProbability: 44.8, underProbability: 55.2 },
  { over: 3.75, under: 0 },
  { minProbability: 51, minOdds: 2 }
)
assert.equal(missingSelectedOdds.market, 'no_bet')
assert.equal(missingSelectedOdds.probability, 55.2)
assert.equal(missingSelectedOdds.odds, 0)
assert.equal(missingSelectedOdds.reason, 'missing_selected_odds')

// Kurs poniżej 2.00 blokuje zakład.
const lowOddsRejected = chooseProbabilityBet(
  { overProbability: 44.2, underProbability: 55.8 },
  { over: 2.9, under: 1.99 },
  { minProbability: 51, minOdds: 2 }
)
assert.equal(lowOddsRejected.market, 'no_bet')
assert.equal(lowOddsRejected.odds, 1.99)
assert.equal(lowOddsRejected.reason, 'odds_below_threshold')

// Kurs dokładnie 2.00 spełnia warunek.
const exactMinimumAccepted = chooseProbabilityBet(
  { overProbability: 44.2, underProbability: 55.8 },
  { over: 2.9, under: 2.0 },
  { minProbability: 51, minOdds: 2 }
)
assert.equal(exactMinimumAccepted.market, 'under_2_5')
assert.equal(exactMinimumAccepted.odds, 2)

console.log('OK: WERSJA 1892 probability-first, minimalny kurs 2.00')
