'use strict'
const assert = require('assert')
const { extractTeamTotalLineV47 } = require('../netlify/functions/_lib/team-total-market')

assert.strictEqual(extractTeamTotalLineV47('Goals Over/Under', 'Brann 2 Over 1.5'), '1.5')
assert.strictEqual(extractTeamTotalLineV47('Goals Over/Under', 'Brann II Under 0.5'), '0.5')
assert.strictEqual(extractTeamTotalLineV47('Home Team Goals', 'Over 1.5'), '1.5')
assert.strictEqual(extractTeamTotalLineV47('Away Team Goals', 'Under 0.5'), '0.5')
assert.strictEqual(extractTeamTotalLineV47('Team Total Goals', '1.5 Over Brann 2'), '1.5')

console.log('team-total-line-number-v47: OK')
