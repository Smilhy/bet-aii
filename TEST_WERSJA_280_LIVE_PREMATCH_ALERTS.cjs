'use strict'
const assert=require('assert')
const {buildPreMatchStateV280,poissonForecast,compareLineup,weatherAdjustment,travelAdjustment}=require('./netlify/functions/_lib/prematch-v280')
const {dueWindow,relevantEventRules}=require('./netlify/functions/_lib/prematch-schedule-v280')
const now=Date.now()
assert.equal(dueWindow(new Date(now+60*60000).toISOString(),now).key,'T60')
assert.equal(dueWindow(new Date(now+15*60000).toISOString(),now).key,'T15')
assert.equal(dueWindow(new Date(now+5*3600000).toISOString(),now),null)
const baseXI={formation:'4-3-3',startXI:Array.from({length:11},(_,i)=>({id:String(i+1),name:`P${i+1}`,pos:i===0?'G':'M'})),official:false,predicted:true}
const liveXI={formation:'4-2-3-1',startXI:Array.from({length:11},(_,i)=>({id:String(i<7?i+1:i+20),name:`N${i}`,pos:i===0?'G':'M'})),official:true,predicted:false}
const cmp=compareLineup(liveXI,baseXI);assert.equal(cmp.official,true);assert.ok(cmp.changes>=4);assert.equal(cmp.formationChanged,true)
const pf=poissonForecast(1.8,1.0);assert.ok(pf.oneXTwo.home>pf.oneXTwo.away);assert.ok(pf.goals.over25>0)
const state=buildPreMatchStateV280({fixture:{id:'1',home:{id:'10'},away:{id:'20'}},baselineForecast:{xg:{home:1.8,away:1.0},oneXTwo:{home:58,draw:25,away:17},goals:{over15:74,over25:56,over35:31,btts:49},reliability:{score:76},professionalLab:{decisionCard:{key:'home',decision:'BET'}}},baselineData:{lineups:{home:baseXI,away:baseXI},injuries:{items:[]}},baselineLineups:{home:baseXI,away:baseXI},latestLineups:{home:liveXI,away:{...baseXI,official:true,predicted:false}},latestInjuries:{home:[],away:[]},weather:{available:true,windKph:48,precipMm:8,temperatureC:11},travel:{available:true,distanceKm:1500},refereeProfile:{sample_size:20,avg_goals:2.8,avg_yellow:4.2,avg_red:.1,avg_fouls:23,avg_penalties:.2},marketTimeline:[]})
assert.equal(state.officialLineups,true);assert.ok(state.changes.length>=2);assert.ok(state.confidence.after<state.confidence.before);assert.ok(state.rescored.xg.home<1.8);assert.ok(state.rescored.xg.away<1.0);assert.ok(['BET','WATCH','NO_BET'].includes(state.decision.after))
assert.equal(weatherAdjustment({available:true,windKph:50,precipMm:8,temperatureC:12}).severity,'HIGH')
assert.equal(travelAdjustment({available:true,distanceKm:1300}).label,'HIGH')
assert.equal(relevantEventRules({event_type:'PROBABILITY_DELTA',detail:{deltaPp:5}},{probability_delta_pp:4}),true)
assert.equal(relevantEventRules({event_type:'PROBABILITY_DELTA',detail:{deltaPp:2}},{probability_delta_pp:4}),false)
console.log('TEST_V280_OK', {decision:state.decision,delta:state.probability.deltaPp,flags:state.flags})
