import fs from 'node:fs'
import assert from 'node:assert/strict'
import { applyFrozenTrackerForOpenV405 } from './src/fmAiTrackerFreezeV402.js'

const baseScan = {
  topFinal: { key:'under25', rawKey:'under25', probability:58, decision:'VALUE', bookmakerOdds:1.95 },
  candidates: [
    { key:'under25', probability:58, decision:'VALUE', bookmakerOdds:1.95, reliability:{score:72} },
    { key:'over25', probability:61, decision:'VALUE', bookmakerOdds:2.05, reliability:{score:76} }
  ]
}

const switched = applyFrozenTrackerForOpenV405(baseScan, {
  fixtureId:'fx-1', key:'over25', probability:61, decision:'VALUE', odds:2.05, reliability:76
})
assert.equal(switched.topFinal.key, 'over25')
assert.equal(switched.canonicalOpenResyncV405?.changed, true)
assert.equal(switched.canonicalOpenResyncV405?.fromKey, 'under25')
assert.equal(switched.canonicalOpenResyncV405?.toKey, 'over25')

const unchanged = applyFrozenTrackerForOpenV405(baseScan, {
  fixtureId:'fx-1', key:'under25', probability:58, decision:'VALUE', odds:1.95, reliability:72
})
assert.equal(unchanged.topFinal.key, 'under25')
assert.equal(Boolean(unchanged.canonicalOpenResyncV405?.changed), false)


const marketMatrix = ['home','draw','away','over15','under15','over25','under25','over35','under35','bttsYes','bttsNo']
let matrixChecks = 0
for (const fromKey of marketMatrix) {
  for (const toKey of marketMatrix) {
    const matrixScan = {
      topFinal:{ key:fromKey, probability:60, decision:'VALUE', bookmakerOdds:2.0 },
      candidates:marketMatrix.map(key => ({ key, probability:60, decision:'VALUE', bookmakerOdds:2.0, reliability:{score:70} }))
    }
    const row = { fixtureId:'fx-matrix', key:toKey, probability:60, decision:'VALUE', odds:2.0, reliability:70 }
    const out = applyFrozenTrackerForOpenV405(matrixScan, row)
    assert.equal(Boolean(out?.canonicalOpenResyncV405?.changed), fromKey !== toKey, `${fromKey} -> ${toKey}`)
    matrixChecks += 1
  }
}

// Alias spellings of the same market must not create a false resync.
const aliasSame = applyFrozenTrackerForOpenV405({
  topFinal:{ key:'under_2_5', probability:60, decision:'VALUE', bookmakerOdds:1.9 },
  candidates:[{ key:'under25', probability:60, decision:'VALUE', bookmakerOdds:1.9, reliability:{score:70} }]
}, { fixtureId:'fx-alias', key:'under25', probability:60, decision:'VALUE', odds:1.9, reliability:70 })
assert.equal(Boolean(aliasSame?.canonicalOpenResyncV405?.changed), false)

const source = fs.readFileSync('./src/MatchSimulatorDailyMatchesView.jsx','utf8')
const guardPos = source.indexOf('if (dailyScan?.canonicalOpenResyncV405?.changed)')
const snapshotPos = source.indexOf('const sharedSnapshotV367 = buildSharedSnapshotV367(match, dailyScan)', guardPos)
const selectPos = source.indexOf('onSelectMatch?.(', guardPos)
assert.ok(guardPos >= 0, 'V405 resync guard missing')
assert.ok(snapshotPos > guardPos, 'resync guard must run before snapshot creation')
assert.ok(selectPos > snapshotPos, 'navigation must happen after the resync guard')
assert.match(source, /await refreshSystemStatsV368\(\{ retry:false \}\)/)
assert.match(source, /Tablica została odświeżona — otwórz mecz ponownie/)

console.log(`V405 NO SILENT MARKET SWITCH: PASS (${matrixChecks} market transitions + alias + handoff guard)`)
