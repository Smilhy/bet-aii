'use strict'
const assert = require('assert')
const {
  inferTeamTotalSideV41,
  normalizeTeamIdentityV44,
  teamIdentityAppearsV44,
} = require('../netlify/functions/_lib/team-total-market')

assert.strictEqual(normalizeTeamIdentityV44('Brann II'), 'brann 2')
assert.strictEqual(normalizeTeamIdentityV44('Brann 2'), 'brann 2')
assert.strictEqual(teamIdentityAppearsV44('Brann 2 Over 1.5', 'Brann II'), true)
assert.strictEqual(inferTeamTotalSideV41('Team Total Goals', 'Brann 2 Over 1.5', 'Brann II', 'Stord'), 'home')
assert.strictEqual(inferTeamTotalSideV41('Team Total Goals', 'Stord Under 1.5', 'Brann II', 'Stord'), 'away')
assert.strictEqual(inferTeamTotalSideV41('Individual Total 1', 'Over 1.5', 'Brann II', 'Stord'), 'home')
assert.strictEqual(inferTeamTotalSideV41('Individual Total 2', 'Under 1.5', 'Brann II', 'Stord'), 'away')
assert.strictEqual(inferTeamTotalSideV41('Team Total Goals', '1 Over 0.5', 'Brann II', 'Stord'), 'home')
assert.strictEqual(inferTeamTotalSideV41('Team Total Goals', '2 Under 0.5', 'Brann II', 'Stord'), 'away')
console.log('team-total-home-away-v44: OK')
