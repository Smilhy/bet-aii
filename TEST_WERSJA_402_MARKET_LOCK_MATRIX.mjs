import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { applyFrozenTrackerPickV402 } from './src/fmAiTrackerFreezeV402.js'
import { mergeCanonicalTopV400, canonicalUiActionV402 } from './src/fmAiCanonicalPipelineV400.js'
import { canonicalFmAiMarketKeyV367, scoreMatchesFmAiMarketV367 } from './src/fmAiConsistencyV367.js'

const require = createRequire(import.meta.url)
const { settleMarket } = require('./netlify/functions/_lib/fm-ai-system-tracker-v368.js')

const markets = ['home','draw','away','over15','under15','over25','under25','over35','under35','bttsYes','bttsNo']
let lockAssertions = 0
for (let index = 0; index < markets.length; index += 1) {
  const key = markets[index]
  const probability = key === 'under25' ? 31 : 58 + (index % 5)
  const odds = 1.7 + index * 0.11
  const exact = {
    key, decision:'STRONG_VALUE', probability: probability + 2, bookmakerOdds: odds + .08,
    fairOdds:100/(probability+2), noVigImplied:Math.max(5, probability-7), edgePp:7,
    expectedValuePct:12, bookmaker:'CurrentBook', reliability:{score:88}, redFlags:[]
  }
  const scan = { candidates:[exact,{key:'over25',decision:'STRONG_VALUE',probability:70,bookmakerOdds:1.8}], topFinal:{key:'over25',decision:'STRONG_VALUE'} }
  const tracker = {
    id:`id-${index}`, fixtureId:`fx-${index}`, publishedAt:'2026-09-13T10:00:00Z',
    key, decision:'VALUE', odds, probability, fairOdds:100/probability,
    edgePp:6.5, expectedValuePct:10.5, reliability:82, dailyScore:73,
    bookmaker:'FrozenBook', noVigImplied:probability-6.5, threshold:5, marketGroup:'TEST'
  }
  const frozen = applyFrozenTrackerPickV402(scan,tracker)
  assert.equal(frozen.topFinal.key,key); lockAssertions++
  assert.equal(frozen.topFinal.bookmakerOdds,odds); lockAssertions++
  assert.equal(frozen.topFinal.probability,probability); lockAssertions++
  const merged = mergeCanonicalTopV400({sharedTop:frozen.topFinal,candidates:[{...exact,decision:'STRONG_VALUE'}],disagreement:'LOW'})
  assert.equal(merged.key,key); lockAssertions++
  assert.equal(merged.bookmakerOdds,odds); lockAssertions++
  assert.equal(merged.probability,probability); lockAssertions++
  assert.equal(canonicalUiActionV402('VALUE',probability,'BET'), probability < 55 ? 'WATCH' : 'BET'); lockAssertions++
}

let settlementComparisons = 0
for (const key of markets) {
  assert.equal(canonicalFmAiMarketKeyV367(key),key)
  for (let home=0; home<=6; home+=1) {
    for (let away=0; away<=6; away+=1) {
      const client = scoreMatchesFmAiMarketV367({home,away},key)
      const server = settleMarket(key,home,away)
      assert.equal(client,server,`settlement parity ${key} ${home}:${away}`)
      settlementComparisons++
    }
  }
}

console.log(`V402 MARKET LOCK MATRIX PASS: ${markets.length} markets, ${lockAssertions} lock assertions, ${settlementComparisons} client/server settlement comparisons`)
