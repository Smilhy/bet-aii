const Module = require('module')
const originalLoad = Module._load
Module._load = function(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => ({}) }
  return originalLoad.call(this, request, parent, isMain)
}

const perf = require('./netlify/functions/get-match-prediction-performance.js')._test

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function makeRows(count = 120) {
  const rows = []
  for (let i = 0; i < count; i += 1) {
    const homeWin = i % 4 !== 0
    const draw = i % 7 === 0
    const hg = draw ? 1 : homeWin ? 2 : 0
    const ag = draw ? 1 : homeWin ? 0 : 1
    rows.push({
      fixture_id: String(i + 1),
      fixture_date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      home_team: `HOME_${i % 6}`,
      away_team: `AWAY_${i % 6}`,
      actual_home_goals: hg,
      actual_away_goals: ag,
      forecast: {
        modelVariants: {
          champion: {
            version: 'BETAI_CHAMPION_V158_CORE',
            oneXTwo: { home: 56, draw: 25, away: 19 },
            goals: { over15: 64, over25: 49, over35: 27, btts: 43 }
          },
          challenger: {
            version: 'BETAI_CHALLENGER_V166_DC_STRENGTH',
            oneXTwo: { home: 65, draw: 22, away: 13 },
            goals: { over15: 72, over25: 53, over35: 28, btts: 39 }
          }
        }
      }
    })
  }
  return rows
}

const rows = makeRows(140)
const cc = perf.buildChampionChallengerV160(rows, [])
assert(cc.pairedSamples === 140, 'Champion/Challenger paired sample mismatch')
assert(['champion', 'challenger'].includes(cc.activeModel), 'Invalid active model')

const championRows = rows.map(row => ({ ...row, forecast: row.forecast.modelVariants.champion }))
const aggregate = perf.aggregateRows(championRows)
const drift = perf.buildDriftDetector(championRows)
const gates = perf.buildAutoGateV162(aggregate, drift)
assert(Array.isArray(gates.markets) && gates.markets.length === 5, 'Auto-Gate did not evaluate all markets')

const strength = perf.buildTeamStrengthV164(rows)
assert(strength.trackedTeams >= 12, 'Team Strength did not build opponent-adjusted ratings')
assert(strength.teams.every(team => Number.isFinite(team.rating)), 'Invalid Elo rating')

const fakeShadow = Array.from({ length: 120 }, (_, i) => ({
  status: i % 2 ? 'won' : 'lost',
  stake_units: 1,
  profit_units: i % 2 ? 0.9 : -1
}))
const stat = perf.buildStatisticalConfidenceV161(aggregate, fakeShadow)
assert(stat.portfolio.samples === 120, 'Statistical Confidence sample mismatch')
assert(stat.portfolio.roi95 && Number.isFinite(stat.portfolio.roi95.low), 'ROI 95% CI missing')

console.log('OK — WERSJA 166 Prediction Engine 2.0 backend tests passed')
console.log({
  championChallenger: { status: cc.status, activeModel: cc.activeModel, pairedSamples: cc.pairedSamples, brierDelta: cc.brierDelta },
  autoGate: gates.markets.map(item => ({ key: item.key, status: item.status })),
  trackedTeams: strength.trackedTeams,
  roi95: stat.portfolio.roi95
})
