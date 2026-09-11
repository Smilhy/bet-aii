import fs from 'fs'
import assert from 'assert'

const source = fs.readFileSync(new URL('./src/valuePolicyV346.js', import.meta.url), 'utf8')
const policy = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

const candidate = (samples, extras = {}) => ({
  key: 'over25',
  edgePp: 15,
  expectedValuePct: 20,
  vigAdjusted: true,
  calibration: { status: 'GOOD', samples, leaguePenalty: 0 },
  ...extras
})
const context = (agreement = 86, extras = {}) => ({ dataQuality: 92, modelAgreement: agreement, marketScore: 92, ...extras })

assert.equal(policy.classifyValueCandidateV346(candidate(29), context()).decision, 'NO_BET', '29 samples must block VALUE')
assert.equal(policy.classifyValueCandidateV346(candidate(36), context()).decision, 'VALUE', '30-99 samples may allow VALUE but not STRONG')
assert.equal(policy.classifyValueCandidateV346(candidate(99), context()).decision, 'VALUE', '99 samples must still block STRONG')
assert.equal(policy.classifyValueCandidateV346(candidate(120), context(55)).decision, 'VALUE', 'agreement below 65 must block STRONG')
assert.equal(policy.classifyValueCandidateV346(candidate(120), context(86)).decision, 'STRONG_VALUE', '100+ samples + agreement + quality may allow STRONG')
assert.equal(policy.classifyValueCandidateV346(candidate(120, { vigAdjusted: false }), context(86)).decision, 'NO_BET', 'missing no-vig market must block recommendation')

console.log('TEST_WERSJA_346_FM_AI_VALUE_GUARD: OK')
