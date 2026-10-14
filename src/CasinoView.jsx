import React, {useState, useEffect, useRef} from 'react'
import './casino.css'

const games = [
  {name:'Keno',icon:'🎱',tone:'green'}, {name:'Target',icon:'🎯',tone:'coral'},
  {name:'Dice',icon:'🎲',tone:'violet',ready:true}, {name:'Tower',icon:'🏰',tone:'blue'},
  {name:'Roulette',icon:'🎡',tone:'pink'}, {name:'Mines',icon:'💣',tone:'purple'},
  {name:'Plinko',icon:'🪙',tone:'gold'}, {name:'Crash',icon:'🚀',tone:'teal'},
  {name:'Hilo',icon:'🃏',tone:'mint'}, {name:'Jackpot',icon:'🏆',tone:'indigo'}
]
const INITIAL_BALANCE = 1000
const fmt = n => Number(n || 0).toFixed(2)
export default function CasinoView(){
 const [page,setPage]=useState('home')
 const [balance,setBalance]=useState(INITIAL_BALANCE)
 const [stake,setStake]=useState('1.00')
 const [chance,setChance]=useState(49.5)
 const [direction,setDirection]=useState('under')
 const [result,setResult]=useState(null)
 const [history,setHistory]=useState([])
 const [tab,setTab]=useState('manual')
 const [running,setRunning]=useState(false)
 const [count,setCount]=useState('20')
 const [stopLoss,setStopLoss]=useState('25')
 const [profitTarget,setProfitTarget]=useState('25')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const session=useRef({running:false,initial:INITIAL_BALANCE,rolls:0})
 const balanceRef=useRef(balance); balanceRef.current=balance
 const stateRef=useRef({stake,chance,direction,stopLoss,profitTarget,count}); stateRef.current={stake,chance,direction,stopLoss,profitTarget,count}
 const payout=(99 / Math.max(1,Number(chance)))
 const wager=history.reduce((a,h)=>a+h.stake,0)
 const profit=balance-INITIAL_BALANCE
 const flash=message=>{setNotice(message);window.setTimeout(()=>setNotice(''),3000)}
 function playRoll(){
   const {stake:betText,chance:chanceValue,direction:way}=stateRef.current
   const bet=Number(betText), c=Number(chanceValue)
   if(!Number.isFinite(bet)||bet<=0||bet>balanceRef.current){flash('Nieprawidłowa stawka lub niewystarczające saldo DEMO');return false}
   if(!Number.isFinite(c)||c<1||c>98){flash('Szansa musi wynosić od 1 do 98%');return false}
   const rand=new Uint32Array(1);crypto.getRandomValues(rand)
   const roll=(rand[0]/4294967296)*100
   const win=way==='under'?roll<c:roll>=100-c
   const net=win?bet*(99/c-1):-bet
   balanceRef.current=Math.max(0,Number((balanceRef.current+net).toFixed(8)))
   setBalance(balanceRef.current)
   const item={id:Date.now()+'-'+rand[0],roll,win,stake:bet,net}
   setResult(item);setHistory(old=>[item,...old].slice(0,200));return true
 }
 function stop(){session.current.running=false;setRunning(false)}
 useEffect(()=>{if(!running)return;session.current.running=true;session.current.initial=balanceRef.current;session.current.rolls=0;let timer;
  function step(){if(!session.current.running)return;const s=stateRef.current;const maximum=Math.min(500,Math.max(1,Math.floor(Number(s.count)||1)));
    if(session.current.rolls>=maximum || (session.current.initial-balanceRef.current)>=Number(s.stopLoss||Infinity) || (balanceRef.current-session.current.initial)>=Number(s.profitTarget||Infinity)){stop();return}
    if(!playRoll()){stop();return}
    session.current.rolls++;timer=window.setTimeout(step,180)
  }timer=window.setTimeout(step,200)
  return()=>{session.current.running=false;window.clearTimeout(timer)}
 },[running])
 function reset(){if(running)return;setBalance(INITIAL_BALANCE);balanceRef.current=INITIAL_BALANCE;setHistory([]);setResult(null)}
 return <div className="smcasino">
   <header className="smcasino-top"><button className="smcasino-brand" onClick={()=>{stop();setPage('home')}}><span>🎲</span><strong>SmilhY<span>Games</span></strong></button><nav><button onClick={()=>{stop();setPage('home')}}>Gry</button><button onClick={()=>{stop();setPage('dice')}}>Dice</button><span className="smcasino-demo">● TRYB DEMO</span></nav><div className="smcasino-money"><small>Saldo testowe</small><b>{fmt(balance)} <em>FUN</em></b></div><button className="smcasino-add" onClick={reset}>↻ Reset salda</button></header>
   {notice&&<div className="smcasino-toast" role="status">{notice}</div>}
   {page==='home'? <div className="smcasino-layout"><main className="smcasino-center">
     <div className="smcasino-winners"><span>🏆 <b>Wyzwania</b><small>Wkrótce</small></span><span>🎁 <b>Nagrody</b><small>Wkrótce</small></span><span>🪙 <b>Rakeback</b><small>Wkrótce</small></span></div>
     <div className="smcasino-promo"><div><span className="smcasino-eyebrow">CRYPTO STYLE • DEMO GAMING</span><h1>Roll. Play.<br/><em>Have Fun.</em></h1><p>Nowoczesne gry w jednym miejscu. Wypróbuj Dice na wirtualnym saldzie.</p><button onClick={()=>setPage('dice')}>Zagraj w Dice <span>→</span></button></div><div className="smcasino-hero-dice" aria-hidden="true">🎲</div></div>
     <div className="smcasino-sectionline"><h2>Nasze gry</h2><span>Prosto • Szybko • Responsywnie</span></div>
     <div className="smcasino-grid">{games.map(g=><button key={g.name} className={'smcasino-tile '+g.tone} onClick={()=>g.ready?setPage('dice'):flash(g.name+' — wkrótce')}><span className="smcasino-tile-art">{g.icon}</span><span className="smcasino-tile-bottom"><b>{g.name.toUpperCase()}</b><small>{g.ready?'● DOSTĘPNE':'WKRÓTCE'}</small></span>{g.ready&&<span className="smcasino-tile-pill">GRAJ</span>}</button>)}</div>
     <div className="smcasino-bottom"><div><strong>💎 Bezpieczne demo</strong><small>Bez prawdziwych wpłat ani wypłat.</small></div><div><strong>⚡ Lekki interfejs</strong><small>Komputer, tablet i telefon.</small></div><div><strong>🎯 Dice</strong><small>Statystyki i automatyczne rzuty.</small></div></div>
   </main><aside className="smcasino-side"><h3><span className="smcasino-dot"/> Aktywność <small>DEMO</small></h3>{history.length?history.slice(0,15).map(h=><div key={h.id} className="smcasino-activity"><span>🎲 Dice <small>{h.roll.toFixed(2)}</small></span><b className={h.win?'positive':'negative'}>{h.net>0?'+':''}{fmt(h.net)}</b></div>):<div className="smcasino-empty">Tu pojawią się Twoje rzuty Dice.<br/>Uruchom grę, aby zobaczyć historię.</div>}</aside></div> : <div className="smcasino-diceview"><div className="smcasino-diceheading"><button onClick={()=>{stop();setPage('home')}}>← Wszystkie gry</button><h1>🎲 Dice</h1><p>Wirtualna gra demonstracyjna • FUN</p></div><div className="smcasino-dicegrid"><section className="smcasino-controls"><div className="smcasino-switch"><button className={tab==='manual'?'selected':''} onClick={()=>{stop();setTab('manual')}}>Ręcznie</button><button className={tab==='auto'?'selected':''} onClick={()=>setTab('auto')}>Auto Dice</button></div><label>Stawka FUN<input type="number" min="0.01" step="0.01" value={stake} onChange={e=>setStake(e.target.value)} disabled={running}/></label><div className="smcasino-quick"><button disabled={running} onClick={()=>setStake(String(Math.max(.01,Number(stake)/2)))}>½</button><button disabled={running} onClick={()=>setStake(String(Number(stake)*2))}>2×</button><button disabled={running} onClick={()=>setStake('1')}>MIN</button><button disabled={running} onClick={()=>setStake(String(balance.toFixed(2)))}>MAX</button></div><label>Szansa wygranej — {Number(chance).toFixed(2)}%<input className="smcasino-range" type="range" min="1" max="98" step="0.5" value={chance} onChange={e=>setChance(Number(e.target.value))} disabled={running}/></label><div className="smcasino-switch"><button className={direction==='under'?'selected':''} disabled={running} onClick={()=>setDirection('under')}>Poniżej</button><button className={direction==='over'?'selected':''} disabled={running} onClick={()=>setDirection('over')}>Powyżej</button></div><div className="smcasino-info"><div><small>Mnożnik</small><b>{payout.toFixed(4)}×</b></div><div><small>Zysk przy wygranej</small><b>{fmt(Number(stake)*(payout-1))} FUN</b></div></div>{tab==='auto'&&<div className="smcasino-autofields"><label>Liczba rzutów (max 500)<input disabled={running} type="number" min="1" max="500" value={count} onChange={e=>setCount(e.target.value)}/></label><label>Stop loss (FUN)<input disabled={running} type="number" min="0.01" value={stopLoss} onChange={e=>setStopLoss(e.target.value)}/></label><label>Cel zysku (FUN)<input disabled={running} type="number" min="0.01" value={profitTarget} onChange={e=>setProfitTarget(e.target.value)}/></label></div>}{tab==='auto'?<button className={'smcasino-play '+(running?'stop':'')} onClick={()=>running?stop():setRunning(true)}>{running?'■ ZATRZYMAJ':'▶ START AUTO DICE'}</button>:<button className="smcasino-play" onClick={playRoll}>🎲 RZUĆ KOSTKĄ</button>}</section><section className="smcasino-rollarea"><small>WYNIK RZUTU</small><div className={'smcasino-number '+(result?(result.win?'positive':'negative'):'')}>{result?result.roll.toFixed(2):'00.00'}</div><div className="smcasino-track"><span style={{width:chance+'%'}}/></div><div className="smcasino-tracklabels"><span>0.00</span><span>100.00</span></div><div className="smcasino-last">{result?(result.win?'WYGRANA +':'PRZEGRANA ')+fmt(result.net)+' FUN':'Ustaw parametry i wykonaj pierwszy rzut'}</div><div className="smcasino-stats"><div><small>Profit</small><b className={profit>=0?'positive':'negative'}>{fmt(profit)}</b></div><div><small>Wager</small><b>{fmt(wager)}</b></div><div><small>Rzuty</small><b>{history.length}</b></div></div></section></div><section className="smcasino-dicehistory"><h3>Historia rzutów</h3>{history.length===0?<p>Brak rzutów</p>:<div className="smcasino-historylist">{history.slice(0,30).map(h=><div key={h.id}><span>{h.roll.toFixed(2)}</span><span>{fmt(h.stake)} FUN</span><strong className={h.win?'positive':'negative'}>{h.net>0?'+':''}{fmt(h.net)} FUN</strong></div>)}</div>}</section></div>}
   <footer className="smcasino-disclaimer">SmilhY Games • Wersja demonstracyjna. Wirtualne środki FUN nie mają wartości pieniężnej. Brak możliwości wpłat i wypłat.</footer>
 </div>
}
