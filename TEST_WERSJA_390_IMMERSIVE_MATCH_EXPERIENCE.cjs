const fs = require('fs')
const assert = (ok, msg) => { if (!ok) throw new Error(msg) }
const prep = fs.readFileSync('src/MatchSimulatorPreparationView.jsx', 'utf8')
const view = fs.readFileSync('src/MatchSimulatorView.jsx', 'utf8')
const canvas = fs.readFileSync('src/RealisticMatchCanvasV320.jsx', 'utf8')
const css = fs.readFileSync('src/styles.css', 'utf8')

const checks = [
  [prep.includes('sim-v390-start-hero'), 'big start CTA missing'],
  [view.includes('fm390-prematch-continuity'), 'pre-match continuity missing'],
  [view.includes('fm390-live-alert'), 'live alert center missing'],
  [view.includes('buildGoalWindowV390'), 'goal window model missing'],
  [view.includes('fm390-event-timeline'), 'interactive timeline missing'],
  [view.includes("setPitchMode('zones')"), 'zone mode missing'],
  [view.includes("setPitchMode('passes')"), 'pass mode missing'],
  [view.includes('[1,2,5,10]'), 'speed controls missing'],
  [view.includes("setCommentaryMode('ai')"), 'AI commentary mode missing'],
  [view.includes('fm390-atmosphere-modes'), 'atmosphere modes missing'],
  [view.includes('TEAM_FAN_IDENTITIES_V390'), 'supporter identity missing'],
  [view.includes('fm390-match-story'), 'full-time match story missing'],
  [view.includes('REPLAY KLUCZOWEGO MOMENTU'), 'replay action missing'],
  [canvas.includes("displayMode = 'match'"), 'canvas display mode missing'],
  [canvas.includes('drawZoneHeatmapV390'), 'heat zones renderer missing'],
  [canvas.includes('drawPassTrailsV390'), 'pass trails renderer missing'],
  [css.includes('V390 — FM AI IMMERSIVE MATCH EXPERIENCE'), 'V390 styles missing']
]
checks.forEach(([ok,msg]) => assert(ok,msg))
console.log(`V390 OK — ${checks.length} feature guards passed`)
