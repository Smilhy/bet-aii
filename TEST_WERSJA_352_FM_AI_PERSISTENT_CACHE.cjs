const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, 'src', 'MatchSimulatorDailyMatchesView.jsx')
const src = fs.readFileSync(file, 'utf8')

const required = [
  "FM_AI_CACHE_PREFIX_V352",
  "window.localStorage.setItem",
  "readFmAiCacheV352(todayKey, clientTimeZone)",
  "bootstrapCacheV352",
  "preserveExisting: true",
  "ODŚWIEŻ ANALIZĘ",
  "bez ponownego pełnego skanu"
]
for (const token of required) {
  if (!src.includes(token)) throw new Error(`Missing V352 cache token: ${token}`)
}

if (!src.includes("complete: Boolean(snapshot.complete)")) throw new Error('Cache completion state is not persisted')
if (!src.includes("if (!cached.complete)")) throw new Error('Interrupted scan resume guard is missing')

console.log('TEST_WERSJA_352_FM_AI_PERSISTENT_CACHE: OK')
