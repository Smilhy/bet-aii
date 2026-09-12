import { buildRealisticMatchV320 } from './src/matchEngineV320.js'
import { canonicalFmAiMarketKeyV367, scoreMatchesFmAiMarketV367, scaleXgToBttsProbabilityV367, bttsProbabilityFromXgV367, shouldHardGuardFmAiPickV367 } from './src/fmAiConsistencyV367.js'

const XI = prefix => Array.from({ length: 11 }, (_, i) => ({
  id: `${prefix}${i}`, name: `${prefix} Player ${i + 1}`, number: i + 1,
  pos: i === 0 ? 'G' : i < 5 ? 'D' : i < 9 ? 'M' : 'F',
  grid: i === 0 ? '1:1' : i < 5 ? `2:${i}` : i < 9 ? `3:${i - 4}` : `4:${i - 8}`
}))
const baseOne = { home: 44, draw: 29, away: 27 }
const model = {
  xg: { home: 1.55, away: 1.25 }, probabilities: baseOne,
  possession: { home: 53, away: 47 },
  strength: { home: { attack: 63, defence: 59, form: 61 }, away: { attack: 59, defence: 57, form: 55 } },
  expected: { homeShots: 12, awayShots: 10 }
}
const mkData = (key, probability = 72.2) => ({
  fixture: { id: `v367-${key}`, home: { name: 'Home' }, away: { name: 'Away' }, league: 'Test League' },
  lineups: { home: { startXI: XI('H'), formation: '4-3-2-1' }, away: { startXI: XI('A'), formation: '4-3-2-1' } },
  predictionEngine: {
    version: 'BETAI_MASTER_CONSENSUS_V353', activeModel: 'BETAI_TEST', oneXTwo: baseOne,
    goals: { over15: 78, over25: 61, over35: 34, btts: 54 },
    xg: { home: 1.55, away: 1.25 }, dataQuality: 90,
    sharedSnapshotV365: { version: 'BETAI_FM_AI_SHARED_SNAPSHOT_V367', topPick: { key, rawKey:key, probability, decision:'VALUE' } }
  }
})

const aliases = {
  over25: ['over25','over_25','over 2.5','total_goals_over_25','goals-over-25'],
  under25: ['under25','under_25','under 2.5','total_goals_under_25'],
  bttsYes: ['bttsYes','BTTS YES','both teams to score','gg'],
  bttsNo: ['bttsNo','BTTS NO','both teams not to score','ng'],
  home: ['home','home win','1'], draw: ['draw','x','tie'], away: ['away','away win','2']
}
for (const [canonical, list] of Object.entries(aliases)) {
  for (const alias of list) {
    const got = canonicalFmAiMarketKeyV367(alias)
    if (got !== canonical) throw new Error(`Canonical mismatch ${alias}: ${got} != ${canonical}`)
  }
}

for (const target of [28, 45, 61, 72.2, 82]) {
  const scaled = scaleXgToBttsProbabilityV367({ home: 1.55, away: 1.25 }, target)
  const actual = bttsProbabilityFromXgV367(scaled)
  if (Math.abs(actual - target) > 1.0) throw new Error(`BTTS xG lock drift: target=${target}, actual=${actual.toFixed(2)}, xg=${JSON.stringify(scaled)}`)
}

if (shouldHardGuardFmAiPickV367({ key:'mystery-market', probability:99, decision:'VALUE' })) throw new Error('Unknown market incorrectly activates hard guard')
if (shouldHardGuardFmAiPickV367({ key:'over25', probability:99, decision:'NO_BET' })) throw new Error('NO_BET helper incorrectly activates hard guard')
if (!shouldHardGuardFmAiPickV367({ key:'over25', probability:72.2, decision:'VALUE' })) throw new Error('Valid VALUE did not activate hard guard')

const cases = ['over15','under15','over25','under25','over35','under35','bttsYes','bttsNo','home','draw','away']
for (const key of cases) {
  const data = mkData(key, 72.2)
  for (let i = 0; i < 48; i += 1) {
    const run = buildRealisticMatchV320(data, model, i)
    if (!scoreMatchesFmAiMarketV367(run.targetFinalScore, key)) throw new Error(`${key} target violates shared pick at ${i}: ${JSON.stringify(run.targetFinalScore)}`)
    if (!scoreMatchesFmAiMarketV367(run.finalScore, key)) throw new Error(`${key} final violates shared pick at ${i}: ${JSON.stringify(run.finalScore)} target=${JSON.stringify(run.targetFinalScore)}`)
    if (run.finalScore.home !== run.targetFinalScore.home || run.finalScore.away !== run.targetFinalScore.away) {
      throw new Error(`${key} reconciliation mismatch at ${i}: final=${JSON.stringify(run.finalScore)} target=${JSON.stringify(run.targetFinalScore)}`)
    }
    if (!run.sharedConstraintV367?.hardGuard || !run.sharedConstraintV367?.satisfied) throw new Error(`${key} hard guard metadata invalid`)
  }
}

// Below threshold the engine must remain probabilistic and must not claim a hard guard.
const soft = buildRealisticMatchV320(mkData('over25', 54.9), model, 0)
if (soft.sharedConstraintV367?.hardGuard) throw new Error('54.9% incorrectly activates hard guard')
const noBetData = mkData('over25', 82)
noBetData.predictionEngine.sharedSnapshotV365.topPick.decision = 'NO_BET'
const noBet = buildRealisticMatchV320(noBetData, model, 0)
if (noBet.sharedConstraintV367?.hardGuard) throw new Error('NO_BET incorrectly activates visual hard guard')

console.log('TEST_V367_FM_AI_CONSISTENCY_OK', { cases: cases.length, scenariosPerCase: 48 })
