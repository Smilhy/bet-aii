'use strict'
const WINDOWS=[{key:'T120',min:105,max:135},{key:'T90',min:75,max:105},{key:'T60',min:52,max:75},{key:'T45',min:37,max:52},{key:'T30',min:22,max:37},{key:'T15',min:5,max:22}]
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function dueWindow(date,now=Date.now()){const k=Date.parse(date||'');if(!Number.isFinite(k)||k<=now)return null;const m=(k-now)/60000;return WINDOWS.find(w=>m>=w.min&&m<w.max)||null}
function relevantEventRules(event,rules={}){const type=String(event?.event_type||event?.eventType||'').trim();if(type==='LINEUP_CONFIRMED')return rules.lineup_confirmed!==false;if(['LINEUP_ROTATION','GOALKEEPER_CHANGE','NEW_STARTER_ABSENCE','FORMATION_CHANGE','WEATHER_SHOCK'].includes(type))return rules.major_change!==false;if(type==='DECISION_CHANGE')return rules.decision_change!==false;if(type==='CONFIDENCE_DROP')return rules.confidence_drop!==false;if(type==='PROBABILITY_DELTA')return Math.abs(num(event?.detail?.deltaPp))>=num(rules.probability_delta_pp,4);if(type==='MARKET_MOVE')return Math.abs(num(event?.detail?.movePp))>=num(rules.market_move_pp,2);return false}
module.exports={WINDOWS,dueWindow,relevantEventRules}
