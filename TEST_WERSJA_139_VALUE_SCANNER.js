const Module = require('module')
const originalLoad = Module._load
Module._load = function patched(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => null }
  return originalLoad.apply(this, arguments)
}
const { buildScan } = require('./netlify/functions/get-match-value-scan')._test
const home = [
  { gf: 2, ga: 1, result: 'W' }, { gf: 1, ga: 0, result: 'W' }, { gf: 1, ga: 1, result: 'D' },
  { gf: 3, ga: 1, result: 'W' }, { gf: 0, ga: 1, result: 'L' }, { gf: 2, ga: 0, result: 'W' }
]
const away = [
  { gf: 1, ga: 2, result: 'L' }, { gf: 1, ga: 1, result: 'D' }, { gf: 0, ga: 1, result: 'L' },
  { gf: 2, ga: 2, result: 'D' }, { gf: 1, ga: 0, result: 'W' }, { gf: 0, ga: 2, result: 'L' }
]
const scan = buildScan({
  fixtureId: '139-test', home: 'Home', away: 'Away', league: 'Test League', country: 'Test',
  recentHome: home, recentAway: away,
  prediction: { available: true, percent: { home: 55, draw: 25, away: 20 }, comparison: { attackHome: 60, attackAway: 42, defenceHome: 64, defenceAway: 45 } },
  oddsBooks: [{ bookmaker: 'Test Book', home: 1.95, draw: 3.5, away: 4.2, over25: 1.9, under25: 1.9, bttsYes: 1.9, bttsNo: 1.9 }]
})
if (!scan?.top || !Number.isFinite(scan?.xg?.home) || !(scan?.probabilities?.oneXTwo?.home > 0)) throw new Error('Value Scanner test failed')
console.log('WERSJA 139 scanner test OK', scan.top.key, scan.top.edgePp, scan.xg)
