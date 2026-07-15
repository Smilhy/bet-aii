
const assert = require('assert')

function line(pick){
  const m = String(pick||'').match(/(\d+(?:[\.,]\d+)?)/)
  return m ? Number(String(m[1]).replace(',', '.')) : null
}
function clean(item){
  const text = `${item.market||''} ${item.pick||''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  const l = line(item.pick)
  const odds = Number(item.odds)
  const isHalf = Number.isFinite(l) && Math.abs((l % 1)-0.5) < 0.001
  const hasSide = text.includes('argentyna') || text.includes('anglia') || text.includes('home') || text.includes('away')
  const hasDir = text.includes('powyzej') || text.includes('ponizej') || text.includes('over') || text.includes('under')
  return hasSide && hasDir && isHalf && l >= 0.5 && l <= 1.5 && odds > 1.001 && odds < 10
}

const rows = [
  { market:'Team Total Goals', pick:'Argentyna powyżej 0.5 gola', odds:2.30 },
  { market:'Team Total Goals', pick:'Argentyna poniżej 0.5 gola', odds:1.62 },
  { market:'Team Total Goals', pick:'Argentyna powyżej 1 gola', odds:7.20 },
  { market:'Team Total Goals', pick:'Argentyna powyżej 2.5 gola', odds:14.00 },
  { market:'Team Total Goals', pick:'Anglia powyżej 1.5 gola', odds:5.95 },
  { market:'Team Total Goals', pick:'Anglia poniżej 1.5 gola', odds:1.10 },
]
const kept = rows.filter(clean).map(r=>r.pick)
assert(kept.includes('Argentyna powyżej 0.5 gola'))
assert(kept.includes('Argentyna poniżej 0.5 gola'))
assert(kept.includes('Anglia poniżej 1.5 gola'))
assert(!kept.includes('Argentyna powyżej 1 gola'))
assert(!kept.includes('Argentyna powyżej 2.5 gola'))
console.log('WERSJA 9 Team Total: filtr linii i kursów OK')
