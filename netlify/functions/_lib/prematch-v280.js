'use strict'

function safe(v, fallback = '') { const s = String(v == null ? '' : v).trim(); return s || fallback }
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback }
function clamp(v, min, max, fallback = 0) { const n = num(v, fallback); return Math.max(min, Math.min(max, n)) }
function round(v, d = 1) { const p = 10 ** d; return Math.round(num(v) * p) / p }
function norm(v = '') { return safe(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() }
function playerKey(p = {}) { return safe(p?.id) || norm(p?.name) }
function starterList(lineup = {}) { return (Array.isArray(lineup?.startXI) ? lineup.startXI : []).slice(0, 11).map(p => ({ id:safe(p?.id), name:safe(p?.name), pos:safe(p?.pos), grid:safe(p?.grid) })).filter(p => p.id || p.name) }
function goalkeeper(lineup = {}) { return starterList(lineup).find(p => String(p.pos).toUpperCase() === 'G') || starterList(lineup)[0] || null }
function lineupOfficial(lineup = {}) { return starterList(lineup).length >= 11 && lineup?.official !== false && !lineup?.predicted }

function normalizeApiLineup(row = null) {
  return {
    available: Boolean(row), official: Boolean(row), predicted: false,
    teamId: safe(row?.team?.id), team: safe(row?.team?.name), formation: safe(row?.formation), coach: safe(row?.coach?.name),
    startXI: (row?.startXI || []).map(e => ({ id:safe(e?.player?.id), name:safe(e?.player?.name), pos:safe(e?.player?.pos), grid:safe(e?.player?.grid), number:num(e?.player?.number) })).filter(p=>p.id||p.name),
    substitutes: (row?.substitutes || []).map(e => ({ id:safe(e?.player?.id), name:safe(e?.player?.name), pos:safe(e?.player?.pos), number:num(e?.player?.number) })).filter(p=>p.id||p.name)
  }
}

function normalizeApiLineups(rows = [], homeId = '', awayId = '') {
  const homeRow = (rows || []).find(r => String(r?.team?.id || '') === String(homeId || '')) || null
  const awayRow = (rows || []).find(r => String(r?.team?.id || '') === String(awayId || '')) || null
  return { home: normalizeApiLineup(homeRow), away: normalizeApiLineup(awayRow) }
}

function normalizeApiInjuries(rows = [], homeId = '', awayId = '') {
  const items = (rows || []).map(r => ({ teamId:safe(r?.team?.id), team:safe(r?.team?.name), player:safe(r?.player?.name), type:safe(r?.player?.type), reason:safe(r?.player?.reason) })).filter(x=>x.player)
  return { items, home:items.filter(x=>x.teamId===String(homeId||'')), away:items.filter(x=>x.teamId===String(awayId||'')) }
}

function compareLineup(current = {}, baseline = {}) {
  const cur = starterList(current), old = starterList(baseline)
  const oldSet = new Set(old.map(playerKey).filter(Boolean)), curSet = new Set(cur.map(playerKey).filter(Boolean))
  const retained = cur.filter(p => oldSet.has(playerKey(p))).length
  const missing = old.filter(p => !curSet.has(playerKey(p)))
  const added = cur.filter(p => !oldSet.has(playerKey(p)))
  const changes = old.length >= 8 && cur.length >= 11 ? Math.max(0, 11 - retained) : null
  const oldGk = goalkeeper(baseline), curGk = goalkeeper(current)
  const gkChanged = Boolean(oldGk && curGk && playerKey(oldGk) !== playerKey(curGk))
  const formationChanged = Boolean(safe(baseline?.formation) && safe(current?.formation) && safe(baseline.formation) !== safe(current.formation))
  return {
    available: old.length >= 8 && cur.length >= 11,
    official: lineupOfficial(current), retained, changes,
    missing: missing.slice(0, 11), added: added.slice(0, 11),
    goalkeeperBefore: safe(oldGk?.name), goalkeeperAfter: safe(curGk?.name), gkChanged,
    formationBefore: safe(baseline?.formation), formationAfter: safe(current?.formation), formationChanged
  }
}

function injuryDelta(current = [], baseline = [], baselineLineup = {}) {
  const old = new Set((baseline || []).map(x => norm(x?.player)).filter(Boolean))
  const starters = new Set(starterList(baselineLineup).map(x => norm(x.name)).filter(Boolean))
  const fresh = (current || []).filter(x => !old.has(norm(x?.player)))
  const newStarterInjuries = fresh.filter(x => starters.has(norm(x?.player)))
  return { newCount:fresh.length, newStarterCount:newStarterInjuries.length, newPlayers:fresh.map(x=>safe(x.player)).slice(0,10), newStarterPlayers:newStarterInjuries.map(x=>safe(x.player)).slice(0,10) }
}

function factorial(n) { let x=1; for(let i=2;i<=n;i+=1)x*=i; return x }
function poisson(lambda, k) { return Math.exp(-lambda) * (lambda ** k) / factorial(k) }
function poissonForecast(homeXg = 1.35, awayXg = 1.10) {
  let h=0,d=0,a=0,o15=0,o25=0,o35=0,btts=0,total=0
  const scores=[]
  for(let hg=0;hg<=8;hg+=1){
    for(let ag=0;ag<=8;ag+=1){
      const p=poisson(homeXg,hg)*poisson(awayXg,ag); total+=p
      if(hg>ag)h+=p; else if(hg===ag)d+=p; else a+=p
      if(hg+ag>=2)o15+=p; if(hg+ag>=3)o25+=p; if(hg+ag>=4)o35+=p; if(hg>0&&ag>0)btts+=p
      scores.push({score:`${hg}:${ag}`,p})
    }
  }
  const normP = x => round((x/Math.max(total,1e-9))*100,1)
  return { oneXTwo:{home:normP(h),draw:normP(d),away:normP(a)}, goals:{over15:normP(o15),over25:normP(o25),over35:normP(o35),btts:normP(btts)}, topScores:scores.sort((x,y)=>y.p-x.p).slice(0,5).map(x=>({score:x.score,probability:normP(x.p)})) }
}
function normalizeTriplet(t = {}) { const s=num(t.home)+num(t.draw)+num(t.away); if(s<=0)return{home:33.3,draw:33.4,away:33.3}; return {home:round(num(t.home)/s*100,1),draw:round(num(t.draw)/s*100,1),away:round(num(t.away)/s*100,1)} }
function blend(base, overlay, w) { return round(num(base)*(1-w)+num(overlay)*w,1) }
function probabilityForKey(f = {}, key='') {
  if(['home','draw','away'].includes(key)) return num(f?.oneXTwo?.[key])
  if(key==='over15') return num(f?.goals?.over15); if(key==='under15') return 100-num(f?.goals?.over15)
  if(key==='over25') return num(f?.goals?.over25); if(key==='under25') return 100-num(f?.goals?.over25)
  if(key==='over35') return num(f?.goals?.over35); if(key==='under35') return 100-num(f?.goals?.over35)
  if(key==='btts'||key==='bttsYes') return num(f?.goals?.btts); if(key==='bttsNo') return 100-num(f?.goals?.btts)
  return 0
}
function normalizeDecision(v='') { const s=safe(v).toUpperCase().replace(/\s+/g,'_'); if(['STRONG_VALUE','VALUE','BET'].includes(s))return'BET'; if(['NO_BET','NO_PREDICTION','BLOCKED'].includes(s))return'NO_BET'; return 'WATCH' }
function confidenceLevel(score=0){return score>=72?'HIGH':score>=56?'MEDIUM':'LOW'}

function marketMove(timeline = [], marketKey = '') {
  const rows=(timeline||[]).filter(r=>!marketKey||safe(r?.market_key||r?.marketKey)===marketKey).sort((a,b)=>Date.parse(a?.captured_at||a?.capturedAt||0)-Date.parse(b?.captured_at||b?.capturedAt||0))
  if(rows.length<2)return{available:false,movePp:0,label:'NO_DATA',first:null,last:null}
  const first=rows[0],last=rows[rows.length-1]
  const p1=100/num(first?.odds,0),p2=100/num(last?.odds,0); if(!Number.isFinite(p1)||!Number.isFinite(p2)||p1<=0||p2<=0)return{available:false,movePp:0,label:'NO_DATA'}
  const move=round(p2-p1,1); const label=move>=3?'STRONG_SHORTENING':move>=1.5?'SHORTENING':move<=-3?'STRONG_DRIFT':move<=-1.5?'DRIFT':'STABLE'
  return{available:true,movePp:move,label,first:{odds:num(first.odds),window:safe(first.snapshot_window||first.window)},last:{odds:num(last.odds),window:safe(last.snapshot_window||last.window)}}
}

function weatherAdjustment(weather = {}) {
  if(!weather?.available)return{available:false,totalXgDelta:0,confidencePenalty:0,severity:'NONE',reasons:[]}
  const wind=num(weather.windKph), rain=num(weather.precipMm), temp=num(weather.temperatureC)
  let delta=0, penalty=0; const reasons=[]
  if(wind>=45){delta-=.14;penalty+=5;reasons.push(`silny wiatr ${round(wind,0)} km/h`)} else if(wind>=32){delta-=.08;penalty+=3;reasons.push(`wiatr ${round(wind,0)} km/h`)}
  if(rain>=7){delta-=.10;penalty+=4;reasons.push(`intensywne opady ${round(rain,1)} mm/h`)} else if(rain>=3){delta-=.05;penalty+=2;reasons.push(`opady ${round(rain,1)} mm/h`)}
  if(temp>=34||temp<=-6){delta-=.05;penalty+=2;reasons.push(`skrajna temperatura ${round(temp,0)}°C`)}
  return{available:true,totalXgDelta:round(clamp(delta,-.22,.04,0),2),confidencePenalty:penalty,severity:penalty>=6?'HIGH':penalty>=3?'MEDIUM':'LOW',reasons}
}

function refereeAdjustment(profile = {}) {
  const n=num(profile?.sample_size||profile?.sampleSize)
  if(n<12)return{available:false,sampleSize:n,totalXgDelta:0,confidencePenalty:0,label:'TRACKING'}
  const goals=num(profile?.avg_goals??profile?.avgGoals,2.65), pens=num(profile?.avg_penalties??profile?.avgPenalties,0)
  const cards=num(profile?.avg_yellow??profile?.avgYellow,0)+num(profile?.avg_red??profile?.avgRed,0)*2
  let delta=clamp((goals-2.65)*.035,-.06,.06,0); if(pens>=.32)delta+=.02
  const label=cards>=5.5?'HIGH_CARD':pens>=.32?'PENALTY_PRONE':'NORMAL'
  return{available:true,sampleSize:n,totalXgDelta:round(clamp(delta,-.07,.08,0),2),confidencePenalty:n<20?1:0,label,avgGoals:round(goals,2),avgYellow:round(num(profile?.avg_yellow??profile?.avgYellow),2),avgRed:round(num(profile?.avg_red??profile?.avgRed),2),avgFouls:round(num(profile?.avg_fouls??profile?.avgFouls),1),avgPenalties:round(pens,2)}
}

function travelAdjustment(travel = {}) {
  const km=num(travel?.distanceKm)
  if(!travel?.available||km<=0)return{available:false,distanceKm:km,awayXgDelta:0,label:'UNKNOWN'}
  let d=0,label='LOW'; if(km>=1800){d=-.07;label='VERY_HIGH'}else if(km>=1000){d=-.05;label='HIGH'}else if(km>=550){d=-.03;label='MEDIUM'}else if(km>=250){d=-.015;label='LOW'}
  return{available:true,distanceKm:round(km,0),awayXgDelta:d,label}
}

function buildPreMatchStateV280(input = {}) {
  const fixture=input.fixture||{}, baselineForecast=input.baselineForecast||{}, baselineData=input.baselineData||{}
  const latest=input.latestLineups||{}, currentInj=input.latestInjuries||{home:[],away:[]}
  const baseLineups=input.baselineLineups||baselineData?.lineups||{}
  const baselineInj=baselineData?.injuries?.items||[]
  const homeId=String(fixture?.home?.id||''),awayId=String(fixture?.away?.id||'')
  const baseHomeInj=baselineInj.filter(x=>String(x?.teamId||'')===homeId), baseAwayInj=baselineInj.filter(x=>String(x?.teamId||'')===awayId)
  const homeCmp=compareLineup(latest.home||{},baseLineups.home||{}), awayCmp=compareLineup(latest.away||{},baseLineups.away||{})
  const homeInj=injuryDelta(currentInj.home||[],baseHomeInj,baseLineups.home||{}), awayInj=injuryDelta(currentInj.away||[],baseAwayInj,baseLineups.away||{})
  const officialCount=[homeCmp.official,awayCmp.official].filter(Boolean).length
  const changes=[]
  for(const [side,c,i] of [['home',homeCmp,homeInj],['away',awayCmp,awayInj]]){
    if(c.official)changes.push({side,type:'LINEUP_CONFIRMED',severity:'info',detail:`${side} official XI`})
    if(c.changes!=null&&c.changes>=4)changes.push({side,type:'LINEUP_ROTATION',severity:c.changes>=6?'critical':'warning',detail:`${c.changes} zmian vs baseline`})
    if(c.gkChanged)changes.push({side,type:'GOALKEEPER_CHANGE',severity:'critical',detail:`${c.goalkeeperBefore||'—'} → ${c.goalkeeperAfter||'—'}`})
    if(c.formationChanged)changes.push({side,type:'FORMATION_CHANGE',severity:'warning',detail:`${c.formationBefore||'—'} → ${c.formationAfter||'—'}`})
    if(i.newStarterCount>0)changes.push({side,type:'NEW_STARTER_ABSENCE',severity:i.newStarterCount>=2?'critical':'warning',detail:i.newStarterPlayers.join(', ')})
  }
  const weather=weatherAdjustment(input.weather||{}), referee=refereeAdjustment(input.refereeProfile||{}), travel=travelAdjustment(input.travel||{})
  const baseXg={home:num(baselineForecast?.contextV260?.adjustedXg?.home??baselineForecast?.xg?.home,1.35),away:num(baselineForecast?.contextV260?.adjustedXg?.away??baselineForecast?.xg?.away,1.10)}
  let homeAdj=0,awayAdj=0
  if(homeCmp.available&&homeCmp.changes>=4)homeAdj-=clamp((homeCmp.changes-3)*.018,0,.09,0)
  if(awayCmp.available&&awayCmp.changes>=4)awayAdj-=clamp((awayCmp.changes-3)*.018,0,.09,0)
  if(homeCmp.gkChanged)awayAdj+=.08; if(awayCmp.gkChanged)homeAdj+=.08
  homeAdj-=clamp(homeInj.newStarterCount*.035,0,.12,0); awayAdj-=clamp(awayInj.newStarterCount*.035,0,.12,0)
  homeAdj+=weather.totalXgDelta/2; awayAdj+=weather.totalXgDelta/2
  homeAdj+=referee.totalXgDelta/2; awayAdj+=referee.totalXgDelta/2
  awayAdj+=travel.awayXgDelta
  homeAdj=round(clamp(homeAdj,-.22,.18,0),2); awayAdj=round(clamp(awayAdj,-.24,.18,0),2)
  const xg={home:round(clamp(baseXg.home+homeAdj,.15,4.2,baseXg.home),2),away:round(clamp(baseXg.away+awayAdj,.12,4.0,baseXg.away),2)}
  const p=poissonForecast(xg.home,xg.away)
  const major=changes.some(x=>x.severity==='critical'), warning=changes.some(x=>x.severity==='warning')
  let weight=officialCount===2?.52:officialCount===1?.40:.24; if(!changes.length&&weather.severity==='NONE'&&!travel.available&&!referee.available)weight=.18
  weight=clamp(weight,.18,.58,.30)
  const trip=normalizeTriplet({home:blend(baselineForecast?.oneXTwo?.home,p.oneXTwo.home,weight),draw:blend(baselineForecast?.oneXTwo?.draw,p.oneXTwo.draw,weight),away:blend(baselineForecast?.oneXTwo?.away,p.oneXTwo.away,weight)})
  const rescored={xg,oneXTwo:trip,goals:{over15:blend(baselineForecast?.goals?.over15,p.goals.over15,weight),over25:blend(baselineForecast?.goals?.over25,p.goals.over25,weight),over35:blend(baselineForecast?.goals?.over35,p.goals.over35,weight),btts:blend(baselineForecast?.goals?.btts,p.goals.btts,weight)},topScores:p.topScores,blendWeight:round(weight,2)}
  const key=safe(baselineForecast?.professionalLab?.decisionCard?.key||baselineForecast?.value?.top?.key,'over25')
  const beforeP=round(probabilityForKey(baselineForecast,key),1), afterP=round(probabilityForKey(rescored,key),1), delta=round(afterP-beforeP,1)
  const beforeDecision=normalizeDecision(baselineForecast?.professionalLab?.decisionCard?.decision||baselineForecast?.value?.state)
  const beforeConf=clamp(baselineForecast?.reliability?.score??baselineForecast?.contextV260?.dataConfidence??60,0,100,60)
  let afterConf=beforeConf+(officialCount===2?3:officialCount===1?1:0)-weather.confidencePenalty-referee.confidencePenalty-(major?8:warning?3:0)
  if(homeCmp.formationChanged||awayCmp.formationChanged)afterConf-=2
  afterConf=Math.round(clamp(afterConf,25,95,beforeConf))
  let afterDecision=beforeDecision
  if(beforeDecision==='BET'){
    if(delta<=-7||major||afterConf<48)afterDecision='NO_BET'; else if(delta<=-3.5||warning||afterConf<58)afterDecision='WATCH'
  } else if(beforeDecision==='WATCH') {
    if(major&&delta<=-4)afterDecision='NO_BET'
  }
  const market=marketMove(input.marketTimeline||[],key)
  const confBeforeLevel=confidenceLevel(beforeConf), confAfterLevel=confidenceLevel(afterConf)
  const flags=[]
  if(officialCount===2)flags.push('LINEUP_CONFIRMED'); else if(officialCount===1)flags.push('PARTIAL_LINEUP')
  if(major||warning)flags.push('MAJOR_CHANGE')
  if(Math.abs(delta)>=3)flags.push('MODEL_MOVED')
  if(market.available&&Math.abs(market.movePp)>=1.5)flags.push('MARKET_MOVED')
  if(afterDecision!==beforeDecision||confAfterLevel!==confBeforeLevel||major||Math.abs(delta)>=4)flags.push('REVIEW_REQUIRED')
  return {
    version:'BETAI_LIVE_PREMATCH_V280', modules:['V261_LINEUP_CONFIRMATION','V262_LAST_MINUTE_CHANGE','V263_PREMATCH_RESCORE','V264_PROBABILITY_DELTA','V265_WEATHER_CONTEXT','V266_REFEREE_CONTEXT','V267_TRAVEL_REST','V268_CONFIDENCE_CHANGE','V269_DECISION_CHANGE_LOG','V270_LIVE_PREMATCH_CONTROL','V271_WATCHLIST','V272_ALERT_RULES','V273_CHANGE_ALERTS','V274_SAVED_ANALYSIS','V275_BEFORE_AFTER','V276_DECISION_HISTORY','V277_DAILY_DIGEST','V278_ALERT_INBOX','V279_USER_WORKFLOW','V280_ALL_IN_CONTROL_CENTER'],
    fixtureId:safe(fixture?.id), checkedAt:new Date().toISOString(), officialLineups:officialCount===2, officialSides:officialCount,
    lineup:{home:homeCmp,away:awayCmp}, injuries:{home:homeInj,away:awayInj}, weather, referee, travel,
    baseXg:{home:round(baseXg.home,2),away:round(baseXg.away,2)}, adjustments:{home:homeAdj,away:awayAdj}, rescored,
    probability:{marketKey:key,before:beforeP,after:afterP,deltaPp:delta},
    confidence:{before:Math.round(beforeConf),after:afterConf,beforeLevel:confBeforeLevel,afterLevel:confAfterLevel},
    decision:{before:beforeDecision,after:afterDecision,changed:beforeDecision!==afterDecision}, market,
    changes, flags:[...new Set(flags)], reviewRequired:flags.includes('REVIEW_REQUIRED')
  }
}

function haversineKm(aLat,aLon,bLat,bLon){
  const R=6371,toRad=x=>x*Math.PI/180; const dLat=toRad(num(bLat)-num(aLat)),dLon=toRad(num(bLon)-num(aLon));
  const s=Math.sin(dLat/2)**2+Math.cos(toRad(num(aLat)))*Math.cos(toRad(num(bLat)))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(s))
}

module.exports={safe,num,clamp,round,norm,normalizeApiLineups,normalizeApiInjuries,buildPreMatchStateV280,poissonForecast,probabilityForKey,marketMove,haversineKm,compareLineup,injuryDelta,weatherAdjustment,refereeAdjustment,travelAdjustment}
