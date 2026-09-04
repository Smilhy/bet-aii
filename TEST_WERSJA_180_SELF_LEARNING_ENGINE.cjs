const assert = require('assert')
const perf = require('/mnt/data/work166/BetAI_WERSJA_166_PREDICTION_ENGINE_2_ALL_IN/netlify/functions/get-match-prediction-performance.js')._test
const V180='BETAI_CHALLENGER_V180_SELF_LEARNING_MATCH_INTEL'
function tripletFor(score, good=true){
  const [h,a]=score
  let win=h>a?'home':h===a?'draw':'away'
  const base=good?15:40, hit=good?70:20
  const one={home:base,draw:base,away:base}; one[win]=hit
  return one
}
function goalsFor(score,good=true){
  const [h,a]=score, total=h+a, vals={over15:total>=2,over25:total>=3,over35:total>=4,btts:h>0&&a>0}
  return Object.fromEntries(Object.entries(vals).map(([k,v])=>[k, good?(v?76:24):(v?28:72)]))
}
function variant(score,good=true,forceWrong=false){
  let oneXTwo=tripletFor(score,good), goals=goalsFor(score,good)
  if(forceWrong){
    const [h,a]=score; const win=h>a?'home':h===a?'draw':'away'; const wrong=win==='home'?'away':win==='away'?'home':'home'; oneXTwo={home:2.5,draw:2.5,away:2.5}; oneXTwo[wrong]=95;
    const total=h+a, vals={over15:total>=2,over25:total>=3,over35:total>=4,btts:h>0&&a>0}; goals=Object.fromEntries(Object.entries(vals).map(([k,v])=>[k,v?3:97]));
  }
  return { oneXTwo, goals, components:{
    poisson:{oneXTwo,goals}, dixonColes:{oneXTwo,goals}, form:{oneXTwo}, api:{oneXTwo}, web:{oneXTwo,goals:{over25:goals.over25,btts:goals.btts}}, teamStrength:{oneXTwo}, recent:{goals}
  }}
}
function rows(count, challengerGood=true, recentBad=false){
  const out=[]
  for(let i=0;i<count;i++){
    const score=i%3===0?[2,0]:i%3===1?[1,1]:[0,2]
    const settled=new Date(Date.now()-(count-i)*86400000/2).toISOString()
    const champion=variant(score,false)
    const badNow=recentBad && i>=count-45
    const challenger=variant(score,badNow?false:challengerGood,badNow)
    const common={fixture_id:String(i+1),fixture_date:settled,home_team:'H'+(i%8),away_team:'A'+(i%8),league:i%2?'Premier League':'Serie A',country:'X',status:'settled',actual_home_goals:score[0],actual_away_goals:score[1],settled_at:settled}
    out.push({...common,model_role:'champion',model_version:'BETAI_CHAMPION_V158_CORE',forecast:champion})
    out.push({...common,model_role:'challenger',model_version:V180,forecast:challenger})
  }
  return out
}
const goodRows=rows(130,true,false)
const self=perf.buildSelfLearningV174(goodRows)
assert.equal(self.samples,130)
assert(self.marketProfiles.length===5)
assert(self.featureLab.length>=5)
assert(self.globalWeights.dixonColes>0)
const gov=perf.buildGovernanceV173(goodRows,null)
assert.equal(gov.action,'PROMOTE')
assert.equal(gov.activeVersion,V180)
const badRows=rows(130,true,true)
const rollback=perf.buildGovernanceV173(badRows,{active_version:V180,previous_version:'BETAI_CHAMPION_V158_CORE'})
assert.equal(rollback.action,'ROLLBACK')
assert.equal(rollback.activeVersion,'BETAI_CHAMPION_V158_CORE')
console.log('V180 SELF LEARNING TEST OK', {samples:self.samples, top:self.featureLab[0], promote:gov.status, rollback:rollback.status})
