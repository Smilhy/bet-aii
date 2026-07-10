const assert = require('node:assert/strict')
const {
  interpolatePressureProbability,
  calculatePressureModel,
  expectedValue,
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

const selected = chooseValueBet(spainBelgium, { over: 1.85, under: 2.0 })
assert.equal(selected.market, 'under_2_5')
assert.equal(selected.edge.toFixed(4), '0.1156')

const noBet = chooseValueBet(spainBelgium, { over: 1.7, under: 1.6 })
assert.equal(noBet.market, 'no_bet')

console.log('OK: WERSJA 1880 algorithm model')
