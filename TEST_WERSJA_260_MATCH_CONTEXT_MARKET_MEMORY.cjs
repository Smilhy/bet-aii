const assert = require('assert')
const Module = require('module')
const originalLoad = Module._load
Module._load = function(request, parent, isMain) { if (request === '@supabase/supabase-js') return { createClient: () => ({}) }; return originalLoad.apply(this, arguments) }
const memory = require('./netlify/functions/get-similar-match-memory-v252.js')._test

const current = { league:'Premier League', home:62, draw:22, away:16, over25:58, btts:52, xgHome:1.85, xgAway:.92, dataQuality:90, odds:1.78 }
const near = { fixture_id:'old-1', league:'Premier League', data_quality:88, actual_home_goals:2, actual_away_goals:1, forecast:{ oneXTwo:{home:60,draw:23,away:17}, goals:{over25:60,btts:54}, xg:{home:1.78,away:.96}, professionalLab:{decisionCard:{bookmakerOdds:1.82}} } }
const far = { fixture_id:'old-2', league:'La Liga', data_quality:62, actual_home_goals:0, actual_away_goals:2, forecast:{ oneXTwo:{home:25,draw:27,away:48}, goals:{over25:35,btts:31}, xg:{home:.72,away:1.75}, professionalLab:{decisionCard:{bookmakerOdds:3.4}} } }
const nearCandidate = memory.candidate(near,current)
const farCandidate = memory.candidate(far,current)
assert(nearCandidate.similarity > farCandidate.similarity)
assert(nearCandidate.similarity > .7)

const rows = [
  nearCandidate,
  { ...nearCandidate, fixtureId:'old-3', hg:1, ag:0, homeWin:true, over25:false, btts:false },
  { ...nearCandidate, fixtureId:'old-4', hg:3, ag:1, homeWin:true, over25:true, btts:true }
]
const summary = memory.aggregate(rows,current)
assert.equal(summary.matches,3)
assert.equal(summary.homeWinRate,100)
assert(summary.over25Rate > 60)
assert(summary.avgHomeGoals > summary.avgAwayGoals)
console.log('TEST_V260_OK')
