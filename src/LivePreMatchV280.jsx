import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const n=(v,f=0)=>{const x=Number(v);return Number.isFinite(x)?x:f}
const safe=(v,f='—')=>{const s=String(v==null?'':v).trim();return s||f}
const pct=v=>`${n(v).toFixed(1)}%`
const pp=v=>`${n(v)>=0?'+':''}${n(v).toFixed(1)} pp`
const xg=v=>n(v).toFixed(2)
const DEFAULT_RULES={lineup_confirmed:true,major_change:true,decision_change:true,confidence_drop:true,probability_delta_pp:4,market_move_pp:2}

async function getJson(url,options={}){const r=await fetch(url,{cache:'no-store',...options});const p=await r.json().catch(()=>({}));if(!r.ok||!p?.ok)throw new Error(p?.error||`HTTP ${r.status}`);return p}
function Pill({children,tone=''}){return <span className={`v280-pill ${tone}`}>{children}</span>}
function Card({label,value,sub,tone=''}){return <article className={tone}><small>{label}</small><b>{value}</b><span>{sub}</span></article>}
function toneForDecision(d=''){return d==='BET'?'ok':d==='NO_BET'?'bad':'watch'}
function eventTitle(type=''){const m={LINEUP_CONFIRMED:'Skład potwierdzony',LINEUP_ROTATION:'Rotacja XI',GOALKEEPER_CHANGE:'Zmiana bramkarza',FORMATION_CHANGE:'Zmiana ustawienia',NEW_STARTER_ABSENCE:'Nowa absencja startera',DECISION_CHANGE:'Zmiana decyzji',CONFIDENCE_DROP:'Spadek confidence',PROBABILITY_DELTA:'Zmiana probability',MARKET_MOVE:'Ruch rynku',WEATHER_SHOCK:'Pogoda'};return m[type]||type}

export default function LivePreMatchV280({lang='pl',match={},data={},forecast=null}){
  const fixtureId=String(match?.apiFixtureId||match?.id||data?.fixture?.id||'')
  const isTest=Boolean(match?.isBetAiLabTest||fixtureId.startsWith('betai-lab-test'))
  const [live,setLive]=useState(null),[center,setCenter]=useState(null),[workflow,setWorkflow]=useState(null),[token,setToken]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(''),[rules,setRules]=useState(DEFAULT_RULES),[browserAlerts,setBrowserAlerts]=useState(typeof Notification!=='undefined'?Notification.permission:'unsupported')
  const pl=lang!=='en'

  const loadPublic=async()=>{if(!fixtureId||isTest)return;try{const [a,b]=await Promise.all([getJson(`/.netlify/functions/get-live-prematch-v280?fixture=${encodeURIComponent(fixtureId)}`),getJson('/.netlify/functions/get-live-prematch-control-center-v280')]);setLive(a);setCenter(b);setError('')}catch(e){setError(e?.message||'Live pre-match unavailable')}}
  const loadWorkflow=async(authToken=token)=>{if(!fixtureId||!authToken)return;try{const p=await getJson(`/.netlify/functions/match-user-workflow-v280?fixture=${encodeURIComponent(fixtureId)}`,{headers:{Authorization:`Bearer ${authToken}`}});setWorkflow(p);setRules({...DEFAULT_RULES,...(p?.watchlist?.rules||{})})}catch(_){} }

  useEffect(()=>{let dead=false;(async()=>{if(!supabase)return;try{const {data:s}=await supabase.auth.getSession();if(dead)return;const t=s?.session?.access_token||'';setToken(t);if(t)loadWorkflow(t)}catch(_){}})();return()=>{dead=true}},[fixtureId])
  useEffect(()=>{if(isTest||!fixtureId)return;loadPublic();const timer=window.setInterval(loadPublic,60000);return()=>window.clearInterval(timer)},[fixtureId,isTest])
  useEffect(()=>{if(token)loadWorkflow(token)},[live?.state?.updated_at])
  useEffect(()=>{
    if(browserAlerts!=='granted'||typeof Notification==='undefined'||!workflow?.alerts?.length)return
    const key='betai-v280-notified';let seen=[];try{seen=JSON.parse(sessionStorage.getItem(key)||'[]')}catch(_){}
    const set=new Set(seen.map(String));const fresh=(workflow.alerts||[]).filter(a=>!a.read_at&&!set.has(String(a.id))).slice(0,4)
    fresh.forEach(a=>{try{new Notification(a.title||'Bet+AI',{body:a.message||'Nowa zmiana przed meczem'})}catch(_){}})
    if(fresh.length){fresh.forEach(a=>set.add(String(a.id)));try{sessionStorage.setItem(key,JSON.stringify([...set].slice(-100)))}catch(_){}}
  },[workflow?.alerts,browserAlerts])

  const state=live?.state||null, events=live?.events||[], history=live?.decisionHistory||workflow?.decisionHistory||[]
  const before=state?.probability_delta?.before??forecast?.professionalLab?.decisionCard?.conservativeProbability??forecast?.value?.top?.probability
  const after=state?.probability_delta?.after??before, delta=state?.probability_delta?.deltaPp??0
  const beforeDecision=state?.decision_before||forecast?.professionalLab?.decisionCard?.decision||'WATCH',afterDecision=state?.decision_after||beforeDecision
  const weather=state?.weather_payload?.adjusted||{}, referee=state?.referee_payload?.adjusted||{}, travel=state?.travel_payload||{}
  const homeRest=forecast?.contextV260?.home?.schedule?.restDays,awayRest=forecast?.contextV260?.away?.schedule?.restDays
  const lineComp=state?.lineup_payload?.comparison||{}
  const currentLineups=state?.lineup_payload?.current||{}
  const centerRows=center?.rows||[]
  const flags=Array.isArray(state?.flags)?state.flags:[]
  const watch=workflow?.watchlist||null

  const post=async(body)=>{if(!token)throw new Error(pl?'Zaloguj się, aby używać tej funkcji.':'Sign in to use this feature.');return getJson('/.netlify/functions/match-user-workflow-v280',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)})}
  const toggleWatch=async()=>{setBusy('watch');try{await post({action:'toggle_watchlist',fixtureId,fixtureDate:data?.fixture?.date||match?.rawDate||match?.date||null,homeTeam:data?.fixture?.home?.name||match?.home||'',awayTeam:data?.fixture?.away?.name||match?.away||'',league:data?.fixture?.league||match?.league||'',enabled:!(watch?.enabled!==false&&watch),rules});await loadWorkflow(token)}catch(e){setError(e.message)}finally{setBusy('')}}
  const saveAnalysis=async()=>{setBusy('save');try{await post({action:'save_analysis',fixtureId,label:`V280 ${new Date().toLocaleString()}`,snapshot:{match:{home:data?.fixture?.home?.name||match?.home,away:data?.fixture?.away?.name||match?.away,fixtureDate:data?.fixture?.date||match?.date},baseline:{xg:forecast?.xg,oneXTwo:forecast?.oneXTwo,goals:forecast?.goals,decision:forecast?.professionalLab?.decisionCard||null},prematch:state}});await loadWorkflow(token)}catch(e){setError(e.message)}finally{setBusy('')}}
  const updateRules=async()=>{setBusy('rules');try{await post({action:'update_rules',fixtureId,rules});await loadWorkflow(token)}catch(e){setError(e.message)}finally{setBusy('')}}
  const markRead=async(id)=>{try{await post({action:'mark_alert_read',id});await loadWorkflow(token)}catch(_){} }
  const enableBrowserAlerts=async()=>{if(typeof Notification==='undefined'){setBrowserAlerts('unsupported');return}try{const p=await Notification.requestPermission();setBrowserAlerts(p)}catch(_){}}

  if(isTest)return <section className="v280-section"><header><div><small>V261–V280 • LIVE PRE-MATCH</small><strong>{pl?'Tryb testowy':'Test mode'}</strong></div><Pill tone="ok">OFFLINE</Pill></header><p className="v280-note">{pl?'Monitor przedmeczowy nie wykonuje zewnętrznych odczytów dla sztucznego fixture.':'Pre-match monitor skips external reads for the synthetic fixture.'}</p></section>

  return <>
    <section className="v280-section v280-hero">
      <header><div><small>V261–V270 • LIVE PRE-MATCH INTELLIGENCE</small><strong>{pl?'Ostatnie 2 godziny przed meczem':'Final 2 hours before kickoff'}</strong><p>{pl?'Oficjalne XI → zmiany → re-score → probability delta → decyzja.':'Official XI → changes → re-score → probability delta → decision.'}</p></div><Pill tone={state?.review_required?'bad':state?.official_lineups?'ok':'watch'}>{state?.status||'TRACKING'}</Pill></header>
      <div className="v280-live-strip">
        <div><small>{pl?'OKNO':'WINDOW'}</small><b>{state?.last_window||'WAIT'}</b><span>{state?.last_checked_at?new Date(state.last_checked_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):pl?'monitor startuje od T-120':'starts at T-120'}</span></div>
        <div><small>{pl?'SKŁADY':'LINEUPS'}</small><b>{state?.official_sides??0}/2</b><span>{state?.official_lineups?(pl?'oba oficjalne':'both official'):(pl?'monitoruję':'tracking')}</span></div>
        <div><small>{pl?'MODEL':'MODEL'}</small><b>{before!=null?pct(before):'—'} → {after!=null?pct(after):'—'}</b><span>{pl?'delta ':''}{pp(delta)}</span></div>
        <div><small>{pl?'DECYZJA':'DECISION'}</small><b className={`tone-${toneForDecision(afterDecision)}`}>{beforeDecision} → {afterDecision}</b><span>{state?.review_required?'REVIEW REQUIRED':pl?'bez wymuszonej zmiany':'no forced change'}</span></div>
      </div>
      <div className="v280-flags">{flags.length?flags.map(f=><span key={f}>{f}</span>):<span>TRACKING</span>}</div>
    </section>

    <section className="v280-section">
      <header><div><small>V261–V264 • LINEUP CONFIRMATION + RE-SCORE</small><strong>{pl?'Przed vs po potwierdzeniu składu':'Before vs confirmed lineup'}</strong><p>{pl?'Model nie nadpisuje starej prognozy — pokazuje osobną, audytowalną korektę pre-match.':'The baseline forecast is preserved; pre-match changes are an auditable overlay.'}</p></div><Pill tone={Math.abs(n(delta))>=7?'bad':Math.abs(n(delta))>=3?'watch':'ok'}>{pp(delta)}</Pill></header>
      <div className="v280-before-after">
        <div><small>BASELINE</small><b>xG {xg(forecast?.contextV260?.adjustedXg?.home||forecast?.xg?.home)} – {xg(forecast?.contextV260?.adjustedXg?.away||forecast?.xg?.away)}</b><span>{pct(before)} • {beforeDecision}</span></div>
        <span>→</span>
        <div><small>LIVE PRE-MATCH</small><b>xG {xg(state?.rescore?.xg?.home||forecast?.contextV260?.adjustedXg?.home||forecast?.xg?.home)} – {xg(state?.rescore?.xg?.away||forecast?.contextV260?.adjustedXg?.away||forecast?.xg?.away)}</b><span>{pct(after)} • {afterDecision}</span></div>
      </div>
      <div className="v280-team-compare">
        {['home','away'].map(side=>{const c=lineComp?.[side]||{},cur=currentLineups?.[side]||{};return <div key={side}><h4>{side==='home'?safe(data?.fixture?.home?.name||match?.home,'HOME'):safe(data?.fixture?.away?.name||match?.away,'AWAY')}</h4><div className="v280-grid two"><Card label="XI STATUS" value={c.official?'OFFICIAL':cur?.startXI?.length>=11?'AVAILABLE':'TRACKING'} sub={c.available?`${c.retained}/11 retained • ${c.changes??0} changes`:(pl?'brak wiarygodnego baseline':'no reliable baseline')} tone={c.changes>=4?'watch':'ok'}/><Card label="GOALKEEPER" value={c.gkChanged?'CHANGED':'STABLE'} sub={c.gkChanged?`${safe(c.goalkeeperBefore)} → ${safe(c.goalkeeperAfter)}`:safe(c.goalkeeperAfter||c.goalkeeperBefore,'—')} tone={c.gkChanged?'bad':'ok'}/></div>{(c.missing||[]).length>0&&<p className="v280-mini"><b>OUT vs baseline:</b> {(c.missing||[]).map(x=>x.name).filter(Boolean).slice(0,5).join(', ')}</p>}</div>})}
      </div>
    </section>

    <section className="v280-section">
      <header><div><small>V265–V267 • EXTERNAL MATCH CONTEXT</small><strong>{pl?'Pogoda • sędzia • podróż / odpoczynek':'Weather • referee • travel / rest'}</strong><p>{pl?'Brak wiarygodnych danych = wpływ 0. Sędzia uczy się wyłącznie z rozliczonych meczów.':'No reliable data = zero impact. Referee profile uses settled matches only.'}</p></div><Pill>{weather?.available||referee?.available||travel?.available?'DATA':'TRACKING'}</Pill></header>
      <div className="v280-grid context">
        <Card label="WEATHER" value={weather?.available?weather.severity||'LOW':'NO DATA'} sub={weather?.available?`${n(state?.weather_payload?.raw?.temperatureC).toFixed(0)}°C • wind ${n(state?.weather_payload?.raw?.windKph).toFixed(0)} km/h • rain ${n(state?.weather_payload?.raw?.precipMm).toFixed(1)} mm/h`:safe(state?.weather_payload?.raw?.reason,pl?'oczekuję na prognozę':'waiting for forecast')} tone={weather?.severity==='HIGH'?'bad':weather?.severity==='MEDIUM'?'watch':''}/>
        <Card label="REFEREE" value={referee?.available?referee.label||'NORMAL':'TRACKING'} sub={referee?.available?`${referee.sampleSize} meczów • YC ${n(referee.avgYellow).toFixed(1)} • fouls ${n(referee.avgFouls).toFixed(1)}`:`sample ${referee?.sampleSize||0}/12`} />
        <Card label="AWAY TRAVEL" value={travel?.available?`${n(travel.distanceKm).toFixed(0)} km`:'UNKNOWN'} sub={travel?.available?`${safe(travel.from)} → ${safe(travel.to)}`:(pl?'baza wyjazdowa zbiera się z meczów domowych':'away base builds from tracked home games')} tone={travel?.label==='VERY_HIGH'||travel?.label==='HIGH'?'watch':''}/>
        <Card label="REST DAYS" value={`${homeRest??'—'} / ${awayRest??'—'}`} sub={pl?'home / away • z Context Engine V260':'home / away • from V260 Context Engine'} />
      </div>
    </section>

    <section className="v280-section">
      <header><div><small>V268–V270 • LIVE CONTROL CENTER</small><strong>{pl?'Zmiany wymagające uwagi':'Changes requiring attention'}</strong><p>{pl?'LINEUP CONFIRMED • MAJOR CHANGE • MODEL MOVED • MARKET MOVED • REVIEW REQUIRED':'LINEUP CONFIRMED • MAJOR CHANGE • MODEL MOVED • MARKET MOVED • REVIEW REQUIRED'}</p></div><Pill tone={(center?.summary?.review||0)>0?'watch':'ok'}>{center?.summary?.review||0} REVIEW</Pill></header>
      <div className="v280-grid control"><Card label="TRACKED" value={center?.summary?.tracked??'—'} sub={`${center?.summary?.ready||0} READY`}/><Card label="XI CONFIRMED" value={center?.summary?.lineupsConfirmed??'—'} sub={pl?'dzisiejsze śledzone mecze':'tracked today'}/><Card label="MODEL MOVED" value={center?.summary?.modelMoved??'—'} sub="|Δ| ≥ 3 pp"/><Card label="MARKET MOVED" value={center?.summary?.marketMoved??'—'} sub="|move| ≥ 1.5 pp"/></div>
      {centerRows.filter(x=>x.review_required).slice(0,6).length>0&&<div className="v280-review-list">{centerRows.filter(x=>x.review_required).slice(0,6).map(r=><span key={r.fixture_id}><b>{r.home_team} – {r.away_team}</b><em>{r.decision_before||'—'} → {r.decision_after||'—'} • {pp(r?.probability_delta?.deltaPp)}</em></span>)}</div>}
      {events.length>0&&<div className="v280-events">{events.slice(0,8).map(e=><span key={e.event_key} className={e.severity}><b>{eventTitle(e.event_type)}</b><em>{safe(e?.detail?.summary||e?.detail?.detail,e.source_window||'')}</em><small>{new Date(e.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></span>)}</div>}
    </section>

    <section className="v280-section v280-workflow">
      <header><div><small>V271–V280 • ALERTS & USER WORKFLOW</small><strong>{pl?'Watchlista, alerty i zapis analiz':'Watchlist, alerts and saved analyses'}</strong><p>{pl?'Alerty są zapisywane w aplikacji; po zgodzie przeglądarki dostajesz je też podczas otwartej sesji.':'Alerts are stored in-app and can also appear as browser notifications while the app is open.'}</p></div><div className="v280-actions"><button onClick={toggleWatch} disabled={busy==='watch'||!token}>{watch?.enabled!==false&&watch?(pl?'✓ OBSERWUJĘ':'✓ WATCHING'):(pl?'＋ WATCHLIST':'＋ WATCHLIST')}</button><button onClick={saveAnalysis} disabled={busy==='save'||!token}>{pl?'ZAPISZ ANALIZĘ':'SAVE ANALYSIS'}</button><button onClick={enableBrowserAlerts} disabled={!token||browserAlerts==='granted'}>{browserAlerts==='granted'?(pl?'🔔 ALERTY ON':'🔔 ALERTS ON'):(pl?'🔔 ALERTY':'🔔 ALERTS')}</button></div></header>
      {!token?<p className="v280-note warn">{pl?'Zaloguj się, aby używać prywatnej watchlisty, reguł alertów i zapisanych analiz.':'Sign in to use private watchlist, alert rules and saved analyses.'}</p>:<>
        <div className="v280-grid workflow"><Card label="WATCHLIST" value={watch?.enabled!==false&&watch?'ON':'OFF'} sub={pl?'monitorowanie tego meczu':'this match monitoring'} tone={watch?'ok':''}/><Card label="ALERT INBOX" value={workflow?.unread??0} sub={`${workflow?.alerts?.length||0} ${pl?'ostatnich alertów':'recent alerts'}`} tone={(workflow?.unread||0)>0?'watch':'ok'}/><Card label="SAVED" value={workflow?.saved?.length||0} sub={pl?'snapshotów tego meczu':'snapshots for this match'}/><Card label="DAILY DIGEST" value={workflow?.digest?.summary?.watchlist??0} sub={workflow?.digest?.digest_date||(pl?'dzisiejsza watchlista':'today watchlist')}/></div>
        {watch&&<div className="v280-rules"><label><input type="checkbox" checked={rules.lineup_confirmed!==false} onChange={e=>setRules({...rules,lineup_confirmed:e.target.checked})}/> XI confirmed</label><label><input type="checkbox" checked={rules.major_change!==false} onChange={e=>setRules({...rules,major_change:e.target.checked})}/> major change</label><label><input type="checkbox" checked={rules.decision_change!==false} onChange={e=>setRules({...rules,decision_change:e.target.checked})}/> decision</label><label><input type="checkbox" checked={rules.confidence_drop!==false} onChange={e=>setRules({...rules,confidence_drop:e.target.checked})}/> confidence</label><label>prob Δ <select value={rules.probability_delta_pp||4} onChange={e=>setRules({...rules,probability_delta_pp:Number(e.target.value)})}><option value="3">3 pp</option><option value="4">4 pp</option><option value="5">5 pp</option><option value="7">7 pp</option></select></label><label>market Δ <select value={rules.market_move_pp||2} onChange={e=>setRules({...rules,market_move_pp:Number(e.target.value)})}><option value="1.5">1.5 pp</option><option value="2">2 pp</option><option value="3">3 pp</option></select></label><button onClick={updateRules} disabled={busy==='rules'}>{pl?'ZAPISZ REGUŁY':'SAVE RULES'}</button></div>}
        {(workflow?.alerts||[]).length>0&&<div className="v280-inbox">{workflow.alerts.slice(0,8).map(a=><button key={a.id} className={a.read_at?'read':''} onClick={()=>markRead(a.id)}><span><b>{a.title}</b><em>{a.message}</em></span><small>{a.read_at?'READ':'NEW'}</small></button>)}</div>}
      </>}
      {history.length>0&&<div className="v280-history"><small>V276 • DECISION HISTORY</small>{history.map((h,i)=><span key={`${h.captured_at}-${i}`}><b>{h.source_window||'CAPTURE'}</b><em className={`tone-${toneForDecision(h.decision)}`}>{h.decision}</em><i>{pct(h.probability)} • conf {h.confidence??'—'} • xG {xg(h?.xg?.home)}–{xg(h?.xg?.away)}</i></span>)}</div>}
    </section>
    {error&&<p className="v280-global-error">{error}</p>}
  </>
}
