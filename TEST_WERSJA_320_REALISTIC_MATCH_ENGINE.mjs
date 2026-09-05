import { buildRealisticMatchV320, collectLiveStatsV320, computeLiveCoachV320, getMatchFrameV320 } from './src/matchEngineV320.js'

const XI = prefix => Array.from({ length: 11 }, (_, i) => ({
  id: `${prefix}${i}`,
  name: `${prefix} Player ${i + 1}`,
  number: i + 1,
  pos: i === 0 ? 'G' : i < 5 ? 'D' : i < 9 ? 'M' : 'F',
  grid: i === 0 ? '1:1' : i < 5 ? `2:${i}` : i < 9 ? `3:${i - 4}` : `4:${i - 8}`
}))

const one = { home: 54, draw: 26, away: 20 }
const data = {
  fixture: { id: 'v320-test', home: { name: 'Home' }, away: { name: 'Away' }, league: 'Test League' },
  lineups: { home: { startXI: XI('H'), formation: '4-3-2-1' }, away: { startXI: XI('A'), formation: '4-3-2-1' } },
  predictionEngine: {
    version: 'BETAI_FORECAST_V260',
    activeModel: 'BETAI_TEST_CHAMPION',
    oneXTwo: one,
    goals: { over15: 75, over25: 57, over35: 31, btts: 52 },
    xg: { home: 1.72, away: 1.08 },
    dataQuality: 90,
    modelInputs: { matchIntelligence: { home: { fatigue: { restDays: 5 } }, away: { fatigue: { restDays: 4 } } } }
  }
}
const model = {
  xg: { home: 1.72, away: 1.08 }, probabilities: one,
  possession: { home: 55, away: 45 },
  strength: { home: { attack: 68, defence: 63, form: 66 }, away: { attack: 56, defence: 54, form: 48 } },
  expected: { homeShots: 13, awayShots: 9 }
}

const a = buildRealisticMatchV320(data, model, 0)
const b = buildRealisticMatchV320(data, model, 0)
const c = buildRealisticMatchV320(data, model, 1)
if (a.seed !== b.seed || JSON.stringify(a.finalScore) !== JSON.stringify(b.finalScore)) throw new Error('Seed replay is not deterministic')
if (a.seed === c.seed) throw new Error('New scenario did not change seed')
if (a.segments.length < 250) throw new Error('Too few continuous action segments')
const ft = collectLiveStatsV320(a, 5400)
if (Math.abs(ft.home.xg - model.xg.home) > .6 || Math.abs(ft.away.xg - model.xg.away) > .6) throw new Error('V320 xG drift too large')
const frame = getMatchFrameV320(a, 1800)
if (!frame.segment || !Number.isFinite(frame.ball.x) || frame.home.length < 10 || frame.away.length < 10) throw new Error('Canvas frame invalid')
const coach = computeLiveCoachV320(a, 2100)
if (!Number.isFinite(coach.oneXTwo.home) || coach.signals.length < 3 || !coach.disclaimer) throw new Error('LIVE AI Coach invalid')

let home = 0, draw = 0, away = 0
const N = 160
for (let i = 0; i < N; i += 1) {
  const run = buildRealisticMatchV320(data, model, i)
  if (run.finalScore.home > run.finalScore.away) home += 1
  else if (run.finalScore.home < run.finalScore.away) away += 1
  else draw += 1
}
const observed = { home: home / N * 100, draw: draw / N * 100, away: away / N * 100 }
if (Math.abs(observed.home - one.home) > 10 || Math.abs(observed.draw - one.draw) > 10 || Math.abs(observed.away - one.away) > 10) throw new Error(`Batch distribution drift: ${JSON.stringify(observed)}`)

console.log('TEST_V320_OK', {
  seed: a.seed,
  segments: a.segments.length,
  events: a.events.length,
  finalScore: a.finalScore,
  finalXg: { home: Number(ft.home.xg.toFixed(2)), away: Number(ft.away.xg.toFixed(2)) },
  liveCoach: { label: coach.topSignal?.label, probability: Math.round(coach.topSignal?.probability || 0), status: coach.topSignal?.status },
  batch160: Object.fromEntries(Object.entries(observed).map(([k, v]) => [k, Number(v.toFixed(1))]))
})
