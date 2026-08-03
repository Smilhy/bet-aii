'use strict'
const assert = require('assert')
const {
  isTeamTotalLikeV41,
  isPureFullTimeTeamTotalBetV41,
  inferTeamTotalSideV41,
} = require('../netlify/functions/_lib/team-total-market')

// Dokładne nazwy pełnomeczowych rynków zwracane przez API-FOOTBALL.
const fullTimeSideMarkets = [
  ['Home Team Goals', 'home'],
  ['Away Team Goals', 'away'],
  ['Home Goals', 'home'],
  ['Away Goals', 'away'],
  ['Team 1 Goals', 'home'],
  ['Team 2 Goals', 'away'],
]

for (const [betName, expectedSide] of fullTimeSideMarkets) {
  assert.strictEqual(isTeamTotalLikeV41(betName), true, `team-total-like: ${betName}`)
  assert.strictEqual(isPureFullTimeTeamTotalBetV41(betName), true, `full-time: ${betName}`)
  assert.strictEqual(inferTeamTotalSideV41(betName, 'Over 1.5', 'Brann II', 'Stord'), expectedSide, `side: ${betName}`)
}

assert.strictEqual(isPureFullTimeTeamTotalBetV41('Home Team Goals First Half'), false)
assert.strictEqual(isPureFullTimeTeamTotalBetV41('Away Team Goals 2nd Half'), false)

console.log('team-total-home-away-v45: OK')
