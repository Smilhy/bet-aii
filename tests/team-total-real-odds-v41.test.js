'use strict'

const assert = require('assert')
const {
  isPureFullTimeTeamTotalBetV41,
  containsPartialPeriodV41,
  inferTeamTotalSideV41,
  isBet365BookmakerV41,
} = require('../netlify/functions/_lib/team-total-market')

const accepted = [
  'Home Team Goals Over/Under',
  'Away Team Goals Over/Under',
  'Home Team - Total Goals',
  'Away Team - Total Goals',
  'Total Goals - Home Team',
  'Total Goals - Away Team',
  'Goals Over/Under - Home Team',
  'Goals Over/Under - Away Team',
  'Home Total Goals',
  'Away Total Goals',
  'Team Total Goals',
]

const rejected = [
  'Home Team Goals Over/Under First Half',
  'Away Team - Total Goals 1st Half',
  'Total Goals - Home Team Second Half',
  'Goals Over/Under - Away Team 2H',
  'Home Team Score a Goal (2nd Half)',
  'Home Corners Over/Under',
]

accepted.forEach(name => assert.strictEqual(isPureFullTimeTeamTotalBetV41(name), true, `accept: ${name}`))
rejected.forEach(name => assert.strictEqual(isPureFullTimeTeamTotalBetV41(name), false, `reject: ${name}`))
assert.strictEqual(containsPartialPeriodV41('Away Team - Total Goals 1st Half'), true)
assert.strictEqual(inferTeamTotalSideV41('Team Total Goals', 'Away Team Over 1.5', 'Brann II', 'Stord'), 'away')
assert.strictEqual(inferTeamTotalSideV41('Total Goals - Home Team', 'Over 1.5', 'Brann II', 'Stord'), 'home')
assert.strictEqual(inferTeamTotalSideV41('Team Total Goals', 'Stord Under 0.5', 'Brann II', 'Stord'), 'away')
assert.strictEqual(isBet365BookmakerV41('Bet365'), true)
assert.strictEqual(isBet365BookmakerV41('bet 365'), true)
assert.strictEqual(isBet365BookmakerV41('Pinnacle'), false)

console.log('team-total-real-odds-v41: OK')
