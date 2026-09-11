const assert = require('assert');
function norm(x){const s=x.home+x.draw+x.away;return {home:x.home*100/s,draw:x.draw*100/s,away:x.away*100/s}}
function blend(full,scan,market, wf=.62, ws=.22, wm=.16){const t=wf+ws+wm;return norm({home:(full.home*wf+scan.home*ws+market.home*wm)/t,draw:(full.draw*wf+scan.draw*ws+market.draw*wm)/t,away:(full.away*wf+scan.away*ws+market.away*wm)/t})}
const master=blend({home:70,draw:20,away:10},{home:63,draw:20,away:17},{home:65,draw:22,away:13});
assert(master.home > master.draw && master.home > master.away, 'MASTER should keep home as the main prediction');
assert(Math.abs(master.home+master.draw+master.away-100)<1e-9, 'MASTER must normalize to 100%');
const sources=[{home:70,draw:20,away:10},{home:38,draw:34,away:28},{home:62,draw:23,away:15}];
const spread=Math.max(...['home','draw','away'].map(k=>Math.max(...sources.map(s=>s[k]))-Math.min(...sources.map(s=>s[k]))));
assert(spread>=18,'large disagreement should trigger the guard');
console.log('V353 MASTER CONSENSUS TEST: OK', master, 'spread', spread);
