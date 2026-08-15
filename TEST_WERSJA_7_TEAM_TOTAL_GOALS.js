const fs = require('fs')
const vm = require('vm')
const assert = require('assert')

const code = fs.readFileSync('netlify/functions/auto-settle-tips.js', 'utf8') + '\n;globalThis.__betaiTest = { settleByKeys, fallbackKeys, lineFromSelection };'
const sandbox = { require, module: { exports: {} }, exports: {}, process, console, globalThis: {} }
vm.runInNewContext(code, sandbox, { filename: 'auto-settle-tips.js' })
const { settleByKeys, fallbackKeys, lineFromSelection } = sandbox.globalThis.__betaiTest

assert.strictEqual(lineFromSelection('over_1_5'), 1.5)
assert.strictEqual(lineFromSelection('under_0_5'), 0.5)

let result = settleByKeys({ market_key: 'team_total_goals', selection_key: 'home_over_1_5' }, 2, 0, [])
assert.strictEqual(result.status, 'won')

result = settleByKeys({ market_key: 'team_total_goals', selection_key: 'away_under_0_5' }, 2, 0, [])
assert.strictEqual(result.status, 'won')

result = settleByKeys({ market_key: 'team_total_goals', selection_key: 'away_over_0_5' }, 2, 0, [])
assert.strictEqual(result.status, 'lost')

const inferred = fallbackKeys({
  market: 'Team Total Goals',
  pick: 'Arsenal powyżej 1.5 gola',
  team_home: 'Arsenal',
  team_away: 'Chelsea'
})
assert.strictEqual(JSON.stringify(inferred), JSON.stringify({ market: 'team_total_goals', selection: 'home_over_1_5' }))

console.log('OK: Team Total Goals — klucze, over/under i rozliczanie drużyn działa.')
