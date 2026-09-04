import React, { useEffect, useMemo, useState } from 'react'
import { buildMarketIntelligenceV230, buildScenarioV238, buildMatchReportV245, SCENARIO_PRESETS_V238, similaritySignatureV252 } from './matchIntelligenceV260'

const safe = (v, f='—') => { const s=String(v==null?'':v).trim(); return s||f }
const num = (v, f=0) => { const n=Number(v); return Number.isFinite(n)?n:f }
const pct = v => `${num(v).toFixed(1)}%`
const pp = v => `${num(v)>=0?'+':''}${num(v).toFixed(1)} pp`
const xg = v => num(v).toFixed(2)

async function getJson(url, options = {}) {
  const r = await fetch(url, { cache:'no-store', ...options })
  const p = await r.json().catch(() => ({}))
  if (!r.ok || !p?.ok) throw new Error(p?.error || `HTTP ${r.status}`)
  return p
}

function StatusPill({ children, tone='' }) { return <span className={`v260-pill ${tone}`}>{children}</span> }
function Metric({ label, value, sub, tone='' }) { return <article className={tone}><small>{label}</small><b>{value}</b><span>{sub}</span></article> }

export default function MatchIntelligenceV260({ match = {}, data = {}, forecast = null, professionalLab = null }) {
  const fixtureId = String(match?.apiFixtureId || match?.id || data?.fixture?.id || '')
  const isTest = Boolean(match?.isBetAiLabTest || fixtureId.startsWith('betai-lab-test'))
  const [replay,setReplay]=useState(null)
  const [memory,setMemory]=useState(null)
  const [command,setCommand]=useState(null)
  const [error,setError]=useState('')
  const [scenarioKey,setScenarioKey]=useState('normal')
  const [reportMode,setReportMode]=useState('short')

  const context = forecast?.contextV260 || null
  const decisionKey = forecast?.professionalLab?.decisionCard?.key || professionalLab?.decisionCard?.key || forecast?.value?.top?.key || 'over25'
  const market = useMemo(() => buildMarketIntelligenceV230({ replay, forecast, marketKey:decisionKey }), [replay,forecast,decisionKey])
  const scenario = useMemo(() => buildScenarioV238({ forecast, presetKey:scenarioKey }), [forecast,scenarioKey])
  const report = useMemo(() => buildMatchReportV245({ match, forecast, context, market, professionalLab }), [match,forecast,context,market,professionalLab])

  useEffect(()=>{
    if(isTest || !fixtureId) return
    let dead=false
    getJson(`/.netlify/functions/get-match-replay?fixture=${encodeURIComponent(fixtureId)}`).then(p=>{if(!dead)setReplay(p)}).catch(()=>{})
    getJson('/.netlify/functions/get-ai-command-center-v260').then(p=>{if(!dead)setCommand(p)}).catch(()=>{})
    return()=>{dead=true}
  },[fixtureId,isTest])

  useEffect(()=>{
    if(isTest || !fixtureId || !forecast) return
    let dead=false
    const signature = similaritySignatureV252({ forecast, league:data?.fixture?.league || match?.league || '' })
    getJson('/.netlify/functions/get-similar-match-memory-v252',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fixtureId,fixtureDate:data?.fixture?.date||match?.rawDate||match?.date||null,signature,limit:120})
    }).then(p=>{if(!dead)setMemory(p)}).catch(e=>{if(!dead)setError(e?.message||'Memory unavailable')})
    return()=>{dead=true}
  },[fixtureId,isTest,forecast,data?.fixture?.league,data?.fixture?.date])

  if(!forecast) return null
  if(isTest) return <section className="v260-section"><header><div><small>V212–V260 • MATCH INTELLIGENCE 4.0</small><strong>Tryb testowy</strong></div><StatusPill tone="ok">OFFLINE</StatusPill></header><p className="v260-note">Context, Scenario i raport działają lokalnie; Similar Match Memory i Command Center są pomijane dla sztucznego fixture.</p></section>

  const homeName=safe(data?.fixture?.home?.name||match?.home,'HOME'), awayName=safe(data?.fixture?.away?.name||match?.away,'AWAY')
  const homeCtx=context?.home||{}, awayCtx=context?.away||{}
  const mem=memory?.summary||{}

  return <>
    <section className="v260-section v260-command">
      <header><div><small>V253–V260 • AI COMMAND CENTER</small><strong>BET+AI TODAY</strong><p>Jedno miejsce: decyzje, edge, ryzyka, model, API i integralność danych.</p></div><StatusPill tone={String(command?.health||'').toLowerCase()==='healthy'?'ok':String(command?.health||'').toLowerCase()==='critical'?'bad':'watch'}>{command?.health||'LOADING'}</StatusPill></header>
      <div className="v260-grid command">
        <Metric label="MECZE W SYSTEMIE" value={command?.today?.fixturesTracked ?? '—'} sub={`${command?.today?.analysed||0} z pełną prognozą`} />
        <Metric label="DECISIONS" value={`${command?.today?.bet||0} BET`} sub={`${command?.today?.watch||0} WATCH • ${command?.today?.noBet||0} NO BET`} />
        <Metric label="TOP CONFIDENCE" value={command?.today?.topConfidence?.probability!=null?pct(command.today.topConfidence.probability):'—'} sub={command?.today?.topConfidence?.match||'brak danych'} />
        <Metric label="TOP EDGE" value={command?.today?.topEdge?.edgePp!=null?pp(command.today.topEdge.edgePp):'—'} sub={command?.today?.topEdge?.match||'brak danych'} />
        <Metric label="RISK RADAR" value={command?.today?.risk?.label||'—'} sub={command?.today?.risk?.reason||'brak krytycznych sygnałów'} tone={command?.today?.risk?.label==='HIGH'?'bad':''}/>
        <Metric label="ACTIVE MODEL" value={command?.model?.activeVersion||'—'} sub={command?.model?.status||'collecting'} />
        <Metric label="DATA INTEGRITY" value={command?.integrity?.score!=null?`${command.integrity.score}%`:'—'} sub={`${command?.integrity?.openAnomalies||0} otwartych anomalii`} />
        <Metric label="READINESS" value={command?.readiness?.score!=null?`${command.readiness.score}/100`:'—'} sub={command?.readiness?.label||'PENDING'} tone={command?.readiness?.score>=80?'ok':command?.readiness?.score<55?'bad':'watch'} />
      </div>
    </section>

    <section className="v260-section">
      <header><div><small>V212–V220 • MATCH CONTEXT ENGINE 4.0</small><strong>Context Adjusted xG</strong><p>XI continuity • absencje ważnościowe • GK • trener • matchup • schedule stress • shock detector</p></div><StatusPill tone={context?.shock?.level==='HIGH'?'bad':context?.shock?.level==='MEDIUM'?'watch':'ok'}>{context?.shock?.level||'TRACKING'}</StatusPill></header>
      <div className="v260-xgline"><div><small>BASE xG</small><b>{xg(context?.baseXg?.home)} – {xg(context?.baseXg?.away)}</b></div><span>→</span><div><small>CONTEXT xG</small><b>{xg(context?.adjustedXg?.home)} – {xg(context?.adjustedXg?.away)}</b></div><em>confidence {context?.dataConfidence||0}/100</em></div>
      <div className="v260-teamcols">
        {[[homeName,homeCtx,'home'],[awayName,awayCtx,'away']].map(([name,row,side])=><div className="v260-team" key={side}>
          <h4>{name}</h4>
          <div className="v260-teamgrid">
            <Metric label="XI CONTINUITY" value={row?.continuity?.available?`${row.continuity.retained}/11`:row?.continuity?.label||'TRACKING'} sub={row?.continuity?.available?`${row.continuity.changes} zmian • ${row.continuity.score}%`:'zbieranie poprzednich XI'} />
            <Metric label="PLAYER IMPORTANCE" value={row?.injuryImportance?.label||'NONE'} sub={`${row?.injuryImportance?.knownPreviousStartersOut||0} poprzednich starterów OUT`} tone={row?.injuryImportance?.label==='HIGH'?'bad':''}/>
            <Metric label="GOALKEEPER" value={row?.goalkeeper?.status||'UNKNOWN'} sub={row?.goalkeeper?.current||'brak danych'} tone={row?.goalkeeper?.changed?'watch':''}/>
            <Metric label="MANAGER" value={row?.manager?.status||'UNKNOWN'} sub={row?.manager?.current||'brak danych'} tone={row?.manager?.changed?'bad':''}/>
            <Metric label="SCHEDULE STRESS" value={row?.schedule?.label||'UNKNOWN'} sub={`${row?.schedule?.restDays??'—'} dni odp. • ${row?.schedule?.matches7d||0} mecze/7d`} tone={row?.schedule?.label==='HIGH'?'bad':row?.schedule?.label==='MEDIUM'?'watch':''}/>
            <Metric label="xG CONTEXT Δ" value={`${num(row?.xgAdjustment)>=0?'+':''}${xg(row?.xgAdjustment)}`} sub="tylko nowe sygnały ponad V180" />
          </div>
        </div>)}
      </div>
      <div className="v260-context-bottom"><span><b>TACTICAL:</b> {context?.tactical?.label||'—'} • home Δ {xg(context?.tactical?.homeAttackVsAwayDefence)} • away Δ {xg(context?.tactical?.awayAttackVsHomeDefence)}</span><span><b>SET PIECES:</b> {context?.setPieces?.status||'NO DATA'} — {context?.setPieces?.note||'bez wpływu na xG'}</span></div>
      {(context?.shock?.shocks||[]).length>0 && <div className="v260-shocks">{context.shock.shocks.map((s,i)=><span key={`${s.type}-${i}`} className={s.severity?.toLowerCase()}><b>{s.side.toUpperCase()} • {s.type}</b>{s.detail}</span>)}</div>}
    </section>

    <section className="v260-section">
      <header><div><small>V221–V230 • MARKET INTELLIGENCE 3.0</small><strong>Market Radar</strong><p>Bookmaker consensus • dispersion • steam/reverse move • stale odds • model-vs-market timeline</p></div><StatusPill tone={market?.confirmation==='CONFIRMED'?'ok':market?.confirmation==='DIVERGENCE'?'watch':''}>{market?.confirmation||'NO DATA'}</StatusPill></header>
      <div className="v260-grid market">
        <Metric label="BOOKMAKERS" value={market?.bookmakerCount||0} sub={`rynek ${market?.marketKey||decisionKey}`} />
        <Metric label="CONSENSUS" value={market?.consensusImpliedProbability!=null?pct(market.consensusImpliedProbability):'—'} sub={market?.modelEdgeVsConsensus!=null?`model ${pp(market.modelEdgeVsConsensus)}`:'czekam na kursy'} />
        <Metric label="DISPERSION" value={`${num(market?.dispersionPp).toFixed(1)} pp`} sub={`stability ${market?.stability||'—'}`} tone={market?.stability==='LOW'?'watch':''}/>
        <Metric label="MARKET MOVE" value={pp(market?.marketMovePp)} sub={market?.steam||'STABLE'} />
        <Metric label="REVERSE MOVE" value={market?.reverseMove?'YES':'NO'} sub={market?.reverseMove?'model i rynek idą przeciwnie':'brak silnego konfliktu'} tone={market?.reverseMove?'bad':'ok'} />
        <Metric label="STALE ODDS" value={market?.staleOdds?.length||0} sub={market?.staleOdds?.length?market.staleOdds.map(x=>x.bookmaker).slice(0,2).join(', '):'nie wykryto'} />
      </div>
      {market?.timeline?.length?<div className="v260-market-timeline">{market.timeline.map((r,i)=><span key={`${r.window}-${r.bookmaker}-${i}`}><small>{r.window||'QUOTE'} • {safe(r.bookmaker,'book')}</small><b>{num(r.odds).toFixed(2)}</b><em>market {pct(r.marketProbability)} • model {r.modelProbability?pct(r.modelProbability):'—'}</em></span>)}</div>:<p className="v260-note">Timeline będzie rosnąć wraz ze snapshotami T-24h / T-6h / T-1h / T-15m.</p>}
    </section>

    <section className="v260-section">
      <header><div><small>V231–V238 • WHAT-IF / SCENARIO LAB</small><strong>Sprawdź scenariusz</strong><p>Heurystyczne testy wrażliwości — nie udają prawdziwej informacji o nieobecnym zawodniku.</p></div><StatusPill>{safe(scenario?.preset?.key,'normal').toUpperCase()}</StatusPill></header>
      <div className="v260-scenario-buttons">{SCENARIO_PRESETS_V238.map(p=><button type="button" className={scenarioKey===p.key?'active':''} key={p.key} onClick={()=>setScenarioKey(p.key)}>{p.label}</button>)}</div>
      <div className="v260-scenario-result"><div><small>xG</small><b>{xg(scenario?.xg?.home)} – {xg(scenario?.xg?.away)}</b></div><div><small>1 / X / 2</small><b>{pct(scenario?.oneXTwo?.home)} / {pct(scenario?.oneXTwo?.draw)} / {pct(scenario?.oneXTwo?.away)}</b></div><div><small>OVER 2.5</small><b>{pct(scenario?.goals?.over25)}</b></div><div><small>BTTS</small><b>{pct(scenario?.goals?.btts)}</b></div></div>
      <p className="v260-note">{scenario?.preset?.note}</p>
    </section>

    <section className="v260-section">
      <header><div><small>V239–V245 • AI MATCH REPORT</small><strong>Wyjaśnienie bez wymyślania danych</strong><p>Raport budowany wyłącznie ze strukturalnych wyników modelu, kontekstu i rynku.</p></div><div className="v260-report-tabs"><button className={reportMode==='short'?'active':''} onClick={()=>setReportMode('short')}>30 SEKUND</button><button className={reportMode==='expert'?'active':''} onClick={()=>setReportMode('expert')}>EKSPERCKA</button></div></header>
      <p className="v260-report-text">{reportMode==='short'?report?.short:report?.expert}</p>
      <div className="v260-report-cols"><div><small>DLACZEGO</small>{(report?.reasons||[]).map((r,i)=><span key={i}>✓ {r}</span>)}</div><div><small>RYZYKA</small>{(report?.risks||[]).map((r,i)=><span key={i}>⚠ {r}</span>)}</div><div><small>CO MOŻE ZMIENIĆ PROGNOZĘ</small>{(report?.changeTriggers||[]).map((r,i)=><span key={i}>→ {r}</span>)}</div></div>
    </section>

    <section className="v260-section">
      <header><div><small>V246–V252 • SIMILAR MATCH MEMORY</small><strong>Historycznie podobne sytuacje</strong><p>Wyłącznie wcześniejsze, rozliczone mecze; bieżący fixture nie może wejść do własnej pamięci.</p></div><StatusPill tone={memory?.confidence==='HIGH'?'ok':memory?.confidence==='LOW'?'watch':''}>{memory?.confidence||'COLLECTING'}</StatusPill></header>
      <div className="v260-grid memory">
        <Metric label="SIMILAR MATCHES" value={mem?.matches??'—'} sub={`z ${memory?.searched||0} historycznych`} />
        <Metric label="HOME WIN" value={mem?.homeWinRate!=null?pct(mem.homeWinRate):'—'} sub="wynik podobnych przypadków" />
        <Metric label="OVER 2.5" value={mem?.over25Rate!=null?pct(mem.over25Rate):'—'} sub="historyczna częstość" />
        <Metric label="BTTS" value={mem?.bttsRate!=null?pct(mem.bttsRate):'—'} sub="historyczna częstość" />
        <Metric label="AVG SCORE" value={mem?.avgHomeGoals!=null?`${num(mem.avgHomeGoals).toFixed(2)}–${num(mem.avgAwayGoals).toFixed(2)}`:'—'} sub="średni realny wynik" />
        <Metric label="MODEL AGREEMENT" value={mem?.modelAgreementPp!=null?`${num(mem.modelAgreementPp).toFixed(1)} pp`:'—'} sub="różnica current vs memory" />
      </div>
      {error&&<p className="v260-note warn">Memory: {error}</p>}
      {memory?.note&&<p className="v260-note">{memory.note}</p>}
    </section>
  </>
}
