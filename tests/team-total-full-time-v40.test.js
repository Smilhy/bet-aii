'use strict'

const assert = require('assert')
const {
  isTeamTotalLikeV40,
  isPureFullTimeTeamTotalBetV40,
} = require('../netlify/functions/_lib/team-total-market')

const accepted = [
  'Home Team Goals Over/Under',
  'Away Team Goals Over/Under',
  'Team Total Goals',
  'Home Team Total Goals',
  'Away Goals Over/Under',
  'Home Team Goals - Full Time',
]

const rejected = [
  'Home Team Goals Over/Under First Half',
  'Away Team Goals Over/Under - 1st Half',
  'Home Team Goals Over/Under Second Half',
  'Away Team Goals Over/Under 2nd Half',
  'Home Team Goals 1H',
  'Away Team Goals 2H',
  'Home Corners Over/Under',
  'Home Team Score a Goal (2nd Half)',
]

accepted.forEach(name => assert.strictEqual(isPureFullTimeTeamTotalBetV40(name), true, `should accept: ${name}`))
rejected.forEach(name => assert.strictEqual(isPureFullTimeTeamTotalBetV40(name), false, `should reject: ${name}`))
assert.strictEqual(isTeamTotalLikeV40('Home Team Goals Over/Under First Half'), true)
assert.strictEqual(isTeamTotalLikeV40('Goals Over/Under'), false)

// Odtworzenie błędu ze screena: pełny mecz miał 1.16, a kurs z innego okresu 2.36.
// Po filtrze do koszyka Team Total pełnego meczu trafia wyłącznie 1.16.
const mixedPeriodOdds = [
  { name: 'Home Team Goals Over/Under', value: 'Over 1.5', odd: 1.16 },
  { name: 'Home Team Goals Over/Under First Half', value: 'Over 1.5', odd: 2.36 },
]
const fullTimeOnly = mixedPeriodOdds.filter(row => isPureFullTimeTeamTotalBetV40(row.name))
assert.deepStrictEqual(fullTimeOnly.map(row => row.odd), [1.16])

console.log('team-total-full-time-v40: OK')
