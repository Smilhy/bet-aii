'use strict'
const assert = require('assert')
const {
  isTeamTotalLikeV41,
  isPureFullTimeTeamTotalBetV41,
  inferTeamTotalSideV41,
} = require('../netlify/functions/_lib/team-total-market')

const accepted = [
  'Home Team Over/Under',
  'Away Team Over/Under',
  'Home Team O/U',
  'Away Team O/U',
  'Individual Total 1',
  'Individual Total 2',
  'Team 1 Total',
  'Team 2 Total',
  'Total Goals - Home Team',
  'Total Goals - Away Team',
]
accepted.forEach(name => {
  assert.strictEqual(isTeamTotalLikeV41(name), true, `like: ${name}`)
  assert.strictEqual(isPureFullTimeTeamTotalBetV41(name), true, `full time: ${name}`)
})

const rejected = [
  'Home Team Over/Under First Half',
  'Away Team O/U 2nd Half',
  'Home Team Corners Over/Under',
  'Away Team Cards Over/Under',
]
rejected.forEach(name => assert.strictEqual(isPureFullTimeTeamTotalBetV41(name), false, `reject: ${name}`))
assert.strictEqual(inferTeamTotalSideV41('Away Team Over/Under', 'Over 1.5', 'Brann II', 'Stord'), 'away')
assert.strictEqual(inferTeamTotalSideV41('Home Team Over/Under', 'Over 1.5', 'Brann II', 'Stord'), 'home')
console.log('team-total-visible-parser-v43: OK')
