const assert = require('node:assert/strict')
const Module = require('node:module')

// Testy czystej logiki bez połączenia z Supabase.
const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@supabase/supabase-js') {
    return { createClient: () => ({}) }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const { __test } = require('./netlify/functions/auto-settle-tips.js')
Module._load = originalLoad

const aetFixture = {
  fixture: { status: { short: 'AET' } },
  goals: { home: 3, away: 2 },
  score: {
    halftime: { home: 1, away: 1 },
    fulltime: { home: 2, away: 2 },
    extratime: { home: 3, away: 2 },
    penalty: { home: null, away: null }
  }
}

const oldDnbTip = {
  market: 'DNB / Remis nie ma zakładu',
  market_key: 'match_winner', // stary błędny zapis
  selection_key: 'home',
  bet_type: 'Belgia DNB',
  prediction: 'Belgia DNB',
  team_home: 'Belgia',
  team_away: 'Senegal',
  odds: 1.55,
  stake: 1000
}

const regularScore = __test.scoreFromFixture(aetFixture)
assert.deepEqual(regularScore, { h: 2, a: 2 }, 'AET musi używać wyniku po 90 minutach')

const keys = __test.fallbackKeys(oldDnbTip)
assert.deepEqual(keys, { market: 'draw_no_bet', selection: 'home' }, 'Stary match_winner DNB musi zostać rozpoznany jako draw_no_bet')

const dnbResult = __test.settleByKeys(oldDnbTip, regularScore.h, regularScore.a, [])
assert.equal(dnbResult.status, 'void', 'Belgia DNB przy 2:2 po 90 min musi być zwrotem')

const payload = __test.updatePayload({ ...dnbResult, settlement_source: 'auto_dnb_regular_time_fix_v6_repaired' }, oldDnbTip)
assert.equal(payload.status, 'void')
assert.equal(payload.profit, 0)
assert.equal(payload.payout, 1000)
assert.equal(payload.return_amount, 1000)

const normalFixture = {
  fixture: { status: { short: 'FT' } },
  goals: { home: 2, away: 1 },
  score: { fulltime: { home: 2, away: 1 } }
}
assert.deepEqual(__test.scoreFromFixture(normalFixture), { h: 2, a: 1 })
assert.equal(__test.settleByKeys(oldDnbTip, 2, 1, []).status, 'won')
assert.equal(__test.settleByKeys(oldDnbTip, 1, 2, []).status, 'lost')

assert.equal(
  __test.missingColumnName({ message: "Could not find the 'settlement_reason' column of 'tips' in the schema cache" }),
  'settlement_reason'
)


async function testSchemaFallback() {
  const attempts = []
  const fakeSupabase = {
    from(table) {
      assert.equal(table, 'tips')
      return {
        update(payload) {
          attempts.push({ ...payload })
          return {
            async eq(column, value) {
              assert.equal(column, 'id')
              assert.equal(value, 'tip-1')
              if (attempts.length === 1) {
                return { error: { message: "Could not find the 'settlement_reason' column of 'tips' in the schema cache" } }
              }
              return { error: null }
            }
          }
        }
      }
    }
  }

  const result = await __test.updateTipWithSchemaFallback(fakeSupabase, 'tip-1', {
    status: 'void',
    settlement_reason: 'DNB remis = zwrot',
    profit: 0
  })
  assert.equal(result.error, null)
  assert.deepEqual(result.removedColumns, ['settlement_reason'])
  assert.equal(attempts.length, 2)
  assert.ok(!('settlement_reason' in attempts[1]))
}

testSchemaFallback().then(() => {
  console.log('OK: DNB jest rozliczane po 90 minutach, remis 2:2 daje VOID/ZWROT, payout = stawka.')
}).catch(error => {
  console.error(error)
  process.exitCode = 1
})
