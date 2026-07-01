const fs = require('fs')
const vm = require('vm')
const path = require('path')

const sourcePath = path.join(__dirname, '..', 'netlify', 'functions', 'auto-settle-tips.js')
let code = fs.readFileSync(sourcePath, 'utf8')
code += '\nmodule.exports.__test = { fallbackKeys, settleByKeys, looksLikeDnbTip, dnbSelectionFromTip };\n'

const sandbox = {
  require,
  module: { exports: {} },
  exports: {},
  process,
  console,
  fetch: async () => { throw new Error('fetch should not run in unit test') },
  URLSearchParams,
  setTimeout,
  clearTimeout,
}
sandbox.exports = sandbox.module.exports
vm.runInNewContext(code, sandbox, { filename: sourcePath })

const api = sandbox.module.exports.__test
const cases = [
  {
    name: 'legacy wrong match_winner key, home DNB, draw',
    tip: {
      market: 'DNB / Remis nie ma zakładu',
      bet_type: 'Belgia DNB',
      market_key: 'match_winner',
      selection_key: 'home',
      team_home: 'Belgia',
      team_away: 'Senegal',
    },
    homeGoals: 2,
    awayGoals: 2,
    expected: 'void',
  },
  {
    name: 'legacy wrong match_winner key, away DNB, draw',
    tip: {
      market: 'Match Winner - Draw No Bet',
      prediction: 'Senegal DNB',
      market_key: 'match_winner',
      selection_key: 'away',
      team_home: 'Belgia',
      team_away: 'Senegal',
    },
    homeGoals: 2,
    awayGoals: 2,
    expected: 'void',
  },
  {
    name: 'home DNB win',
    tip: {
      market: 'DNB / Remis nie ma zakładu',
      bet_type: 'Belgia DNB',
      market_key: 'draw_no_bet',
      selection_key: 'home',
      team_home: 'Belgia',
      team_away: 'Senegal',
    },
    homeGoals: 3,
    awayGoals: 2,
    expected: 'won',
  },
  {
    name: 'home DNB loss',
    tip: {
      market: 'DNB / Remis nie ma zakładu',
      bet_type: 'Belgia DNB',
      market_key: 'draw_no_bet',
      selection_key: 'home',
      team_home: 'Belgia',
      team_away: 'Senegal',
    },
    homeGoals: 1,
    awayGoals: 2,
    expected: 'lost',
  },
]

for (const testCase of cases) {
  const keys = api.fallbackKeys(testCase.tip)
  const result = api.settleByKeys(testCase.tip, testCase.homeGoals, testCase.awayGoals, [], {})
  if (keys.market !== 'draw_no_bet') {
    throw new Error(`${testCase.name}: expected draw_no_bet, got ${keys.market}`)
  }
  if (result.status !== testCase.expected) {
    throw new Error(`${testCase.name}: expected ${testCase.expected}, got ${result.status}`)
  }
  console.log(`PASS: ${testCase.name} -> ${result.status}`)
}
