const fs = require('fs')
const assert = (ok, msg) => { if (!ok) throw new Error(msg) }
const prep = fs.readFileSync('src/MatchSimulatorPreparationView.jsx', 'utf8')
const css = fs.readFileSync('src/styles.css', 'utf8')
const checks = [
  [prep.includes('featuredMatchV391'), 'featured match data model missing'],
  [prep.includes('fm391-featured-match'), 'featured match showcase missing'],
  [prep.includes('fm391-team-comparison'), 'team comparison missing'],
  [prep.includes('fm391-win-probability'), '1X2 probability panel missing'],
  [prep.includes('fm391-verdict-card'), 'AI verdict card missing'],
  [prep.includes('fm391-confidence'), 'confidence ring missing'],
  [prep.includes('fm391-key-markets'), 'key markets panel missing'],
  [prep.includes('homeForm:recentHome'), 'recent form data missing'],
  [prep.includes('marketOdds:Number(professionalLab?.decisionCard?.bookmakerOdds || 0)'), 'market odds bridge missing'],
  [css.includes('V391 — FEATURED MATCH INTELLIGENCE SHOWCASE'), 'V391 styles missing'],
  [css.includes('.fm391-featured-grid'), 'featured grid styles missing'],
  [css.includes('@media(max-width:480px)'), 'responsive rules missing']
]
checks.forEach(([ok,msg]) => assert(ok,msg))
console.log(`V391 OK — ${checks.length} feature guards passed`)
