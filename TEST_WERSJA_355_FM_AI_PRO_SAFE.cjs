const fs=require('fs'); const assert=require('assert');
const fm=fs.readFileSync('src/MatchSimulatorDailyMatchesView.jsx','utf8');
const main=fs.readFileSync('src/main.jsx','utf8');
const css=fs.readFileSync('src/styles.css','utf8');
for(const m of ['buildDemoEntryV355','demoModeV355','sim-v355-command','sim-v355-featured','sim-v355-picks','Mecze do symulacji','isBetAiLabTest']) assert(fm.includes(m),`missing FM marker ${m}`);
for(const m of ['BETAI_REQUEST_MEMO_V355','fetchPublicTipsCachedV355','BETAI_REFERRAL_CACHE_V355']) assert(main.includes(m),`missing optimization ${m}`);
for(const m of ['.sim-v355-command','.sim-v355-featured','.sim-v355-picks-grid','.sim-v355-demo-note']) assert(css.includes(m),`missing CSS ${m}`);
assert(fm.includes('PERSISTENT DAILY CACHE') || fm.includes('readFmAiCacheV352'),'V352 daily cache was removed');
console.log('TEST_WERSJA_355_FM_AI_PRO_SAFE: OK');
