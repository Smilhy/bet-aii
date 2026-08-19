const fs = require('fs')
const source = fs.readFileSync('src/main.jsx', 'utf8')
const checks = [
  ['epoch guard', 'accountEpochRefV76'],
  ['active identity', 'activeAccountRefV76'],
  ['central activator', 'activateSessionUserV76'],
  ['UUID-first ranking', 'if (id) return `id:${id}`'],
  ['strict UUID identity', 'if (leftId && rightId) return leftId === rightId'],
  ['no login profile upsert marker', 'NIE wykonujemy już automatycznego upsertu email/username'],
  ['no previous-balance inheritance', 'nigdy nie dziedziczymy salda poprzedniego konta'],
]
for (const [label, marker] of checks) {
  if (!source.includes(marker)) throw new Error(`V76 FAIL: ${label}`)
}
console.log('OK: V76 account identity hard isolation markers present.')
