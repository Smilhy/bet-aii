'use strict'
const assert = require('assert')
const {
  isTeamTotalCandidateV46,
  inferTeamTotalSideV41,
} = require('../netlify/functions/_lib/team-total-market')

const home = 'Brann II'
const away = 'Stord'

assert.strictEqual(isTeamTotalCandidateV46('Goals Over/Under', 'Brann II Over 1.5', home, away), true)
assert.strictEqual(isTeamTotalCandidateV46('Goals Over/Under', 'Home Over 0.5', home, away), true)
assert.strictEqual(isTeamTotalCandidateV46('Goals Over/Under', 'Stord Under 1.5', home, away), true)
assert.strictEqual(isTeamTotalCandidateV46('Goals Over/Under', 'Over 2.5', home, away), false)
assert.strictEqual(isTeamTotalCandidateV46('Home Team Goals First Half', 'Over 1.5', home, away), false)
assert.strictEqual(inferTeamTotalSideV41('Goals Over/Under', 'Brann II Over 1.5', home, away), 'home')
assert.strictEqual(inferTeamTotalSideV41('Goals Over/Under', 'Stord Under 1.5', home, away), 'away')

console.log('team-total-home-away-v46: OK')
