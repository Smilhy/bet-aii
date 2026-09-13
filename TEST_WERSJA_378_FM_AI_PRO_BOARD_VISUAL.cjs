const assert = require('assert')
const fs = require('fs')
const suite = fs.readFileSync('src/FmAiProMarketSuiteV377.jsx','utf8')
const css = fs.readFileSync('src/styles.css','utf8')
for (const marker of [
  'BoardIconV378',
  'FM AI • V378',
  'sim-v378-metric-strip',
  'sim-v378-filter-shell',
  'sim-v378-mini-track',
  'sim-v378-row-actions',
  'resetBoard'
]) assert(suite.includes(marker), `Missing V378 JSX marker: ${marker}`)
for (const marker of [
  'V378 — FM AI PRO OPPORTUNITY BOARD',
  '.sim-v378-board',
  '.sim-v378-board-kicker',
  '.sim-v378-metric-strip',
  '.sim-v378-board-table-wrap',
  '.sim-v378-decision-pill',
  '.sim-v378-mini-track'
]) assert(css.includes(marker), `Missing V378 CSS marker: ${marker}`)
console.log('TEST_WERSJA_378_FM_AI_PRO_BOARD_VISUAL: OK')
