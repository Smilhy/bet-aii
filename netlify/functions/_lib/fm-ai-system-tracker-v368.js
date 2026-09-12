function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function round(v,d=2){const f=10**d;return Math.round((n(v)+Number.EPSILON)*f)/f}
function settleMarket(key,h,a){
  const total=h+a
  if(key==='home')return h>a
  if(key==='draw')return h===a
  if(key==='away')return a>h
  if(key==='over15')return total>=2
  if(key==='under15')return total<=1
  if(key==='over25')return total>=3
  if(key==='under25')return total<=2
  if(key==='over35')return total>=4
  if(key==='under35')return total<=3
  if(key==='bttsYes')return h>0&&a>0
  if(key==='bttsNo')return h===0||a===0
  return null
}
function summary(rows=[]){
  const resolved=rows.filter(r=>['win','loss','void'].includes(r.status))
  const graded=rows.filter(r=>['win','loss'].includes(r.status))
  const wins=graded.filter(r=>r.status==='win').length
  const losses=graded.filter(r=>r.status==='loss').length
  const voids=resolved.filter(r=>r.status==='void').length
  const pending=rows.filter(r=>r.status==='pending').length
  const profit=resolved.reduce((s,r)=>s+n(r.profit_pln),0)
  const stake=resolved.reduce((s,r)=>s+n(r.stake_pln,10),0)
  const hitRate=graded.length?wins/graded.length*100:0
  const avgOdds=graded.length?graded.reduce((s,r)=>s+n(r.odds),0)/graded.length:0
  const breakEven=graded.length?graded.reduce((s,r)=>s+(n(r.odds)>1?100/n(r.odds):0),0)/graded.length:0
  let bank=0,peak=0,maxDd=0,lossStreak=0,maxLossStreak=0
  const chronological=[...resolved].sort((a,b)=>Date.parse(a.fixture_date)-Date.parse(b.fixture_date))
  for(const r of chronological){
    bank+=n(r.profit_pln); peak=Math.max(peak,bank); maxDd=Math.max(maxDd,peak-bank)
    if(r.status==='loss'){lossStreak++;maxLossStreak=Math.max(maxLossStreak,lossStreak)} else if(r.status==='win'){lossStreak=0}
  }
  const sample=graded.length
  const evidence=sample<30?'ZA MAŁA PRÓBA':sample<100?'WSTĘPNY SYGNAŁ':sample<300?'ŚREDNIA PRÓBA':'DUŻA PRÓBA'
  const edge=hitRate-breakEven
  const verdict=sample<30?'COLLECTING':profit>0&&edge>1?'POSITIVE_SIGNAL':profit>0?'SLIGHT_POSITIVE':'NEGATIVE'
  return {picks:rows.length,resolved:resolved.length,pending,wins,losses,voids,stake:round(stake),profit:round(profit),yieldPct:stake?round(profit/stake*100):0,hitRate:round(hitRate,1),avgOdds:round(avgOdds,2),breakEvenHitRate:round(breakEven,1),hitEdgePp:round(edge,1),maxDrawdown:round(maxDd),maxLossStreak,evidence,verdict}
}
function group(rows,keyFn){const m=new Map();for(const r of rows){const k=keyFn(r)||'Inne';if(!m.has(k))m.set(k,[]);m.get(k).push(r)}return [...m.entries()].map(([name,items])=>({name,...summary(items)})).sort((a,b)=>b.picks-a.picks||b.yieldPct-a.yieldPct)}
module.exports={n,round,settleMarket,summary,group}
