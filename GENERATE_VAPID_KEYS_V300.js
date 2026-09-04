'use strict'
try {
  const webpush = require('web-push')
  const keys = webpush.generateVAPIDKeys()
  console.log('VAPID_PUBLIC_KEY=' + keys.publicKey)
  console.log('VAPID_PRIVATE_KEY=' + keys.privateKey)
  console.log('VAPID_SUBJECT=mailto:admin@bet-ai.app')
  console.log('\nWklej te 3 wartości do Netlify -> Site configuration -> Environment variables. Nie publikuj PRIVATE_KEY.')
} catch (e) {
  console.error('Najpierw uruchom npm install. Brak pakietu web-push:', e.message)
  process.exitCode = 1
}
