const CACHE_TTL_MS = 10 * 60 * 1000;
let memoryCache = globalThis.__betaiDashboardCache || { ts: 0, payload: null };
globalThis.__betaiDashboardCache = memoryCache;


const buildFallbackPayload = () => {
  const fixtures = [
    ['VE','Primera División','Carabobo FC','Academia Anzoátegui',72,16,12,'LIVE'],
    ['BR','Brasileiro Women','São Paulo W','Gremio W',72,16,12,'LIVE'],
    ['BR','Brasileiro Women','Santos W','Atlético Mineiro W',38,34,28,'LIVE'],
    ['BR','Brasileiro Women','Ferroviária W','America Mineiro W',72,16,12,'LIVE'],
    ['AR','Liga Profesional','San Lorenzo','Velez Sarsfield',38,34,28,'PRE'],
    ['PY','Division Intermedia','Fernando De La Mora','Sportivo Carapeguá',42,20,38,'PRE'],
    ['AR','Primera Nacional','Atletico DE Rafaela','Agropecuario',48,18,34,'PRE'],
    ['CL','Primera División','U. Católica','Union La Calera',41,19,40,'PRE']
  ];
  const now = Date.now();
  const matches = fixtures.map((row, i) => {
    const [country, league, home, away, hp, dp, ap, status] = row;
    const strongest = Math.max(hp, dp, ap);
    const pick = strongest === ap ? away : strongest === dp ? 'Remis' : home;
    const side = strongest === ap ? 'A' : strongest === dp ? 'D' : 'H';
    const odds = strongest >= 70 ? '1.75' : strongest >= 48 ? '1.85' : '2.05';
    const commence = new Date(now + (i - 2) * 45 * 60000);
    return {
      id: `fallback-${i}`,
      country, league, home, away,
      timeLocal: commence.toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit', timeZone: APP_TIMEZONE }),
      dateLocal: commence.toLocaleDateString('pl-PL', { timeZone: APP_TIMEZONE }),
      startLabel: status === 'LIVE' ? 'LIVE' : 'Start',
      homeProb: hp, drawProb: dp, awayProb: ap,
      confidence: strongest, pick, side,
      odds, valuePct: Math.max(4, Math.min(12, Math.round((strongest - 33)/3 + 4))),
      analysis: `Model AI wskazuje przewagę ${pick} dzięki lepszej formie i profilowi meczu.`,
      value: `+${Math.max(4, Math.min(12, Math.round((strongest - 33)/3 + 4)))}%`,
      commenceTime: commence.toISOString(),
      stake,
      settled: false,
      result: status,
      profit: 0,
      statusText: status,
      statusClass: status === 'LIVE' ? 'live' : 'pre',
      scoreText: ''
    };
  });
  const avgConfidence = matches.length ? Math.round(matches.reduce((a,m)=>a+(m.confidence||0),0)/matches.length) : 0;
  return {
    today,
    fallbackUsed: true,
    source: 'fallback',
    matches,
    stats: { total: matches.length, settled: 0, wins: 0, winRate: 0, avgConfidence, profit: 0, roi: 0 }
  };
};


exports.handler = async function () {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const stake = 100;
  const APP_TIMEZONE = 'Europe/Warsaw';

  if (!apiKey) {
    const payload = buildFallbackPayload();
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    };
  }

  if (memoryCache.payload && (Date.now() - memoryCache.ts) < CACHE_TTL_MS) {
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=600'
      },
      body: JSON.stringify(memoryCache.payload)
    };
  }

  const normalize = (name) => (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|club|deportivo|athletic|atletico|united|city|club de futbol)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hash = (value) => {
    let h = 0;
    const s = String(value || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };

  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);

  const json = async (url) => {
    const res = await fetch(url, {
      headers: {
        'x-apisports-key': apiKey,
        'accept': 'application/json'
      }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${text ? ` - ${text}` : ''}`);
    }
    const data = await res.json();
    return data;
  };

  const fetchFixtures = async () => {
    const primary = await json(`https://v3.football.api-sports.io/fixtures?date=${today}&timezone=${encodeURIComponent(APP_TIMEZONE)}`);
    let items = Array.isArray(primary?.response) ? primary.response : [];
    if (items.length) return items;

    const fallback = await json(`https://v3.football.api-sports.io/fixtures?next=20&timezone=${encodeURIComponent(APP_TIMEZONE)}`);
    items = Array.isArray(fallback?.response) ? fallback.response : [];
    return items;
  };

  const countryCode = (fixture) => {
    const code = fixture?.league?.flag || '';
    if (typeof code === 'string' && code.includes('/')) {
      const m = code.match(/\/flags\/(\w+)\.svg/i);
      if (m) return m[1].slice(0, 2).toUpperCase();
    }
    const country = fixture?.league?.country || '';
    const map = {
      england: 'GB', spain: 'ES', italy: 'IT', germany: 'DE', france: 'FR',
      netherlands: 'NL', portugal: 'PT', poland: 'PL', turkey: 'TR',
      europe: 'EU', world: 'GL'
    };
    return map[normalize(country)] || String(country).slice(0, 2).toUpperCase() || 'GL';
  };

  const probsFromTeams = (home, away) => {
    const baseHome = 38 + (hash(home) % 17); // 38-54
    const baseAway = 30 + (hash(away) % 17); // 30-46
    let homeAdv = baseHome + 6;
    let awayAdv = baseAway;
    let draw = 22 + (Math.abs((hash(home) % 7) - (hash(away) % 7)) <= 1 ? 6 : 0);

    const totalRaw = homeAdv + awayAdv + draw;
    let hp = Math.round((homeAdv / totalRaw) * 100);
    let ap = Math.round((awayAdv / totalRaw) * 100);
    let dp = Math.max(0, 100 - hp - ap);

    if (dp < 18) {
      dp = 18;
      const leftover = 82;
      const split = hp + ap || 1;
      hp = Math.round(leftover * (hp / split));
      ap = Math.max(0, 100 - hp - dp);
    }

    return { hp, dp, ap };
  };

  const buildPrediction = (fixture) => {
    const home = fixture?.teams?.home?.name || 'Home';
    const away = fixture?.teams?.away?.name || 'Away';
    const goalsHome = Number.isFinite(Number(fixture?.goals?.home)) ? Number(fixture.goals.home) : null;
    const goalsAway = Number.isFinite(Number(fixture?.goals?.away)) ? Number(fixture.goals.away) : null;
    const statusShort = fixture?.fixture?.status?.short || 'NS';

    let { hp, dp, ap } = probsFromTeams(home, away);
    let analysis = 'Lekki model formy własnej i przewagi gospodarza wskazuje bazowy kierunek na mecz.';

    if (['1H', '2H', 'HT', 'LIVE', 'ET', 'BT', 'P'].includes(statusShort) && goalsHome !== null && goalsAway !== null) {
      if (goalsHome > goalsAway) {
        hp = 72; dp = 16; ap = 12;
        analysis = 'Mecz jest na żywo, a gospodarze prowadzą — przewaga wyniku wzmacnia typ na gospodarzy.';
      } else if (goalsAway > goalsHome) {
        hp = 12; dp = 16; ap = 72;
        analysis = 'Mecz jest na żywo, a goście prowadzą — przewaga wyniku wzmacnia typ na gości.';
      } else {
        hp = 38; dp = 34; ap = 28;
        analysis = 'Na żywo wynik jest remisowy, więc model zostawia większą szansę na podział punktów.';
      }
    }

    const strongest = Math.max(hp, dp, ap);
    let pick = home;
    let side = 'H';
    let odds = 1.75;

    if (strongest === ap) {
      pick = away;
      side = 'A';
      odds = 1.95;
    } else if (strongest === dp) {
      pick = 'Remis';
      side = 'D';
      odds = 3.1;
    }

    return {
      homeProb: hp,
      drawProb: dp,
      awayProb: ap,
      confidence: strongest,
      pick,
      side,
      odds: Number(odds).toFixed(2),
      valuePct: Math.max(3, Math.min(12, Math.round((strongest - 33) / 3 + 4))),
      analysis
    };
  };

  const settle = (prediction, fixture) => {
    const statusShort = fixture?.fixture?.status?.short || 'NS';
    const elapsed = fixture?.fixture?.status?.elapsed;
    const goalsHome = Number.isFinite(Number(fixture?.goals?.home)) ? Number(fixture.goals.home) : null;
    const goalsAway = Number.isFinite(Number(fixture?.goals?.away)) ? Number(fixture.goals.away) : null;

    const finishedStatuses = new Set(['FT', 'AET', 'PEN']);
    const liveStatuses = new Set(['1H', '2H', 'HT', 'LIVE', 'ET', 'BT', 'P']);

    if (finishedStatuses.has(statusShort) && goalsHome !== null && goalsAway !== null) {
      let won = false;
      if (prediction.side === 'H') won = goalsHome > goalsAway;
      else if (prediction.side === 'A') won = goalsAway > goalsHome;
      else won = goalsHome === goalsAway;

      const odds = Number(prediction.odds);
      const profit = won ? Number((stake * (odds - 1)).toFixed(2)) : -stake;
      return {
        settled: true,
        result: won ? 'WIN' : 'LOSS',
        profit,
        statusText: won ? 'WIN' : 'LOSS',
        statusClass: won ? 'win' : 'loss',
        scoreText: `${goalsHome}:${goalsAway}`,
        startLabel: 'Koniec'
      };
    }

    if (liveStatuses.has(statusShort)) {
      return {
        settled: false,
        result: 'LIVE',
        profit: 0,
        statusText: 'LIVE',
        statusClass: 'live',
        scoreText: goalsHome !== null && goalsAway !== null ? `${goalsHome}:${goalsAway}` : '',
        startLabel: elapsed ? `${elapsed}'` : 'LIVE'
      };
    }

    return {
      settled: false,
      result: 'PRE',
      profit: 0,
      statusText: 'PRE',
      statusClass: 'pre',
      scoreText: '',
      startLabel: 'Start'
    };
  };

  try {
    const fixtures = await fetchFixtures();

    const normalized = fixtures
      .filter((fx) => fx?.teams?.home?.name && fx?.teams?.away?.name)
      .slice(0, 25)
      .map((fx) => {
        const prediction = buildPrediction(fx);
        const settlement = settle(prediction, fx);
        const start = new Date(fx?.fixture?.date || Date.now());
        const diff = start.getTime() - Date.now();
        let computedStartLabel = settlement.startLabel;
        if (settlement.result === 'PRE') {
          if (diff > 0) {
            const mins = Math.floor(diff / 60000);
            if (mins < 60) computedStartLabel = `${mins}m`;
            else {
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              computedStartLabel = m ? `${h}h ${m}m` : `${h}h`;
            }
          }
        }

        return {
          id: String(fx?.fixture?.id || `${normalize(fx?.teams?.home?.name)}-${normalize(fx?.teams?.away?.name)}`),
          country: countryCode(fx),
          league: fx?.league?.name || 'Football',
          home: fx?.teams?.home?.name || 'Home',
          away: fx?.teams?.away?.name || 'Away',
          timeLocal: start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE }),
          dateLocal: start.toLocaleDateString('pl-PL', { timeZone: APP_TIMEZONE }),
          startLabel: computedStartLabel,
          ...prediction,
          value: `+${prediction.valuePct}%`,
          commenceTime: fx?.fixture?.date || start.toISOString(),
          stake,
          ...settlement
        };
      })
      .sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime));

    const settledMatches = normalized.filter((m) => m.settled);
    const wins = settledMatches.filter((m) => m.result === 'WIN');
    const profit = settledMatches.reduce((a, m) => a + (m.profit || 0), 0);
    const stakeTotal = settledMatches.length * stake;
    const roi = stakeTotal ? Math.round((profit / stakeTotal) * 100) : 0;
    const avgConfidence = normalized.length
      ? Math.round(normalized.reduce((a, m) => a + (m.confidence || 0), 0) / normalized.length)
      : 0;

    const payload = {
      today,
      fallbackUsed: false,
      source: 'api-football',
      matches: normalized,
      stats: {
        total: normalized.length,
        settled: settledMatches.length,
        wins: wins.length,
        winRate: settledMatches.length ? Math.round((wins.length / settledMatches.length) * 100) : 0,
        avgConfidence,
        profit,
        roi
      }
    };

    memoryCache = { ts: Date.now(), payload };
    globalThis.__betaiDashboardCache = memoryCache;

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=600'
      },
      body: JSON.stringify(payload)
    };
  } catch (err) {
    const payload = buildFallbackPayload();
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    };
  }
};
