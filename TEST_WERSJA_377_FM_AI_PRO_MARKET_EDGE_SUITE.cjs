const assert = require('assert')
const fs = require('fs')

const daily = fs.readFileSync('src/MatchSimulatorDailyMatchesView.jsx','utf8')
const suite = fs.readFileSync('src/FmAiProMarketSuiteV377.jsx','utf8')
const css = fs.readFileSync('src/styles.css','utf8')

for (const marker of [
  "FmAiOpportunityBoardV377",
  "FmAiMarketPulseV377",
  "FmAiPortfolioRiskV377",
  "FmAiModelVsMarketV377",
  "useSelectedBetAiTimeZoneV377",
  "betai-timezone-changed"
]) assert(daily.includes(marker), `Missing V377 daily marker: ${marker}`)

for (const marker of [
  'PRO OPPORTUNITY BOARD',
  'MARKET PULSE + PRICE SHOP',
  'PORTFOLIO CONCENTRATION',
  'MODEL vs MARKET',
  'normalizeMarketQuotesV377',
  'buildMarketPulseV377',
  'buildPortfolioRiskV377'
]) assert(suite.includes(marker), `Missing V377 suite marker: ${marker}`)

for (const marker of [
  'sim-v377-board',
  'sim-v377-market-pulse',
  'sim-v377-portfolio-risk',
  'sim-v377-model-market'
]) assert(css.includes(marker), `Missing V377 CSS marker: ${marker}`)

// No new backend/API dependency was added by V377.
const packageJson = JSON.parse(fs.readFileSync('package.json','utf8'))
assert(packageJson.version.startsWith('377.'))
console.log('TEST_WERSJA_377_FM_AI_PRO_MARKET_EDGE_SUITE: OK')
