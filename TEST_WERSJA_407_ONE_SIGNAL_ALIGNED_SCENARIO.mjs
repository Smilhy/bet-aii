import { buildRealisticMatchV320 } from './src/matchEngineV320.js'
import { scoreMatchesFmAiMarketV367, canonicalFmAiMarketKeyV367 } from './src/fmAiConsistencyV367.js'

const markets = ['home','draw','away','over15','under15','over25','under25','over35','under35','bttsYes','bttsNo']
let checked = 0
for (const decision of ['NO_BET','VALUE','STRONG_VALUE']) {
  for (const key of markets) {
    for (let ordinal = 0; ordinal < 9; ordinal += 1) {
      const data = {
        fixture: { id:`v407-${decision}-${key}`, home:{name:'Home'}, away:{name:'Away'} },
        predictionEngine: {
          version:'V407_TEST',
          oneXTwo:{home:39.1,draw:26.3,away:34.6},
          sharedSnapshotV365:{topPick:{key, rawKey:key, probability:key==='away'?34.6:61.2, decision}}
        },
        lineups:{home:{startXI:[],substitutes:[]},away:{startXI:[],substitutes:[]}}
      }
      const model = {
        xg:{home:1.56,away:1.51},
        probabilities:{home:39.1,draw:26.3,away:34.6},
        expected:{homeShots:12,awayShots:13},
        possession:{home:48,away:52}
      }
      const out = buildRealisticMatchV320(data, model, ordinal)
      if (!out?.sharedConstraintV367?.hardGuard) throw new Error(`V407 guard missing: ${decision}/${key}/${ordinal}`)
      if (!scoreMatchesFmAiMarketV367(out.finalScore, canonicalFmAiMarketKeyV367(key))) {
        throw new Error(`V407 mismatch ${decision}/${key}/${ordinal}: ${out.finalScore.home}:${out.finalScore.away}`)
      }
      checked += 1
    }
  }
}
console.log(`V407 PASS: ${checked}/${checked} representative scenarios match the frozen FM AI candidate (including NO_BET).`)
