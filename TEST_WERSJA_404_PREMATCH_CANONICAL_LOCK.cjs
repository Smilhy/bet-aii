const assert=require('assert')
const fs=require('fs')
const {applyCanonicalTrackerBaselineV404,buildPreMatchStateV280}=require('./netlify/functions/_lib/prematch-v280')

const base={
  oneXTwo:{home:55,draw:25,away:20},
  goals:{over15:78,over25:66,over35:42,btts:58},
  xg:{home:1.8,away:1.1},
  value:{state:'STRONG_VALUE',top:{key:'over25',probability:66,decision:'STRONG_VALUE'}},
  professionalLab:{decisionCard:{key:'over25',decision:'BET',conservativeProbability:62}}
}
const tracker={fixture_id:'fx',market_key:'under25',decision:'VALUE',odds:4.2,ai_probability:31.2,fair_odds:3.21,edge_pp:7.4,expected_value_pct:31}
const locked=applyCanonicalTrackerBaselineV404(base,tracker)
assert.equal(locked.value.top.key,'under25')
assert.equal(locked.professionalLab.decisionCard.key,'under25')
assert.equal(locked.professionalLab.decisionCard.decision,'BET')
assert.equal(locked.goals.over25,68.8)
assert.equal(locked.sharedSnapshotV365.topPick.key,'under25')
assert.equal(locked.sharedSnapshotV365.topPick.probability,31.2)

const state=buildPreMatchStateV280({fixture:{id:'fx',home:{id:'h'},away:{id:'a'}},baselineForecast:locked,baselineData:{lineups:{home:{},away:{}},injuries:{items:[]}},baselineLineups:{home:{},away:{}},latestLineups:{home:{},away:{}},latestInjuries:{home:[],away:[]},weather:{available:false},refereeProfile:{},travel:{available:false},marketTimeline:[]})
assert.equal(state.probability.marketKey,'under25')
assert.equal(state.probability.before,31.2)
assert.equal(state.decision.before,'BET')

const capture=fs.readFileSync('./netlify/functions/capture-live-prematch-v280.js','utf8')
assert(capture.includes("from('fm_ai_system_picks_v368')"),'prematch backend must read canonical tracker')
assert(capture.includes('applyCanonicalTrackerBaselineV404'),'prematch backend must overlay canonical tracker')
assert(capture.includes('state.canonicalTrackerV404'),'prematch state must expose canonical marker')

const ui=fs.readFileSync('./src/LivePreMatchV280.jsx','utf8')
assert(ui.includes('stateMatchesCanonicalV404'),'live prematch UI must reject stale different-market state')
assert(ui.includes("['CANONICAL_SYNC_V404']"),'live prematch UI must expose canonical sync flag')
assert(ui.includes('canonicalFmAiMarketKeyV367(h.market_key)===canonicalKeyV404'),'decision history must filter to canonical market')

const ops=fs.readFileSync('./src/MatchOperationsV211.jsx','utf8')
assert(ops.includes('forecast?.sharedSnapshotV365?.topPick'),'operations view must prefer shared canonical top')
assert(ops.includes('currentMarketV404'),'operations current market must be canonical')
assert(!ops.includes("<b>{latestFreeze?.decision || forecast?.professionalLab?.decisionCard?.decision || '—'}</b>"),'old replay freeze must not override current canonical decision')

console.log('V404 PREMATCH CANONICAL LOCK: 5 groups PASS')
