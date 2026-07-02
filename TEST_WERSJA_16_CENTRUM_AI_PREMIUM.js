const assert = require('assert')
const fs = require('fs')

const component = fs.readFileSync('./src/AiControlCenter.jsx', 'utf8')
const styles = fs.readFileSync('./src/styles.css', 'utf8')

assert.ok(component.includes('aicc-premium-v16'))
assert.ok(component.includes('Kontrola systemów AI'))
assert.ok(component.includes('Przegląd'))
assert.ok(component.includes('Alerty wymagające uwagi'))
assert.ok(component.includes('Historia uruchomień'))
assert.ok(!component.includes('Dane są żywe, nie demonstracyjne.'))
assert.ok(styles.includes('WERSJA 16 — CENTRUM AI PREMIUM UI'))
assert.ok(styles.includes('.aicc-premium-v16 .aicc-hero h1'))
assert.ok(styles.includes('.aicc-premium-v16 .aicc-system-identity h3'))
assert.ok(styles.includes('.aicc-premium-v16 .aicc-metrics-grid'))

console.log('WERSJA 16 Centrum AI Premium: testy UI OK')
