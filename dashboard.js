
exports.handler = async function(event) {
  const apiKey = process.env.ODDS_API_KEY || '53d18e4b61ca17f380c995dd19067053';
  const stake = 100;
  const APP_TIMEZONE = 'Europe/Warsaw';

  const json = async (url) => {
    const res = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const normalize = (name) => (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|club|deportivo|athletic|atletico)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const zonedParts = (d) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).formatToParts(new Date(d));
    const get = (type) => parts.find(p => p.type === type)?.value || '00';
    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      hour: Number(get('hour')),
      minute: Number(get('minute')),
      second: Number(get('second')),
    };
  };

  const dayKey = (d) => {
    const p = zonedParts(d);
    return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
  };

  const now = new Date();
  const localToday = dayKey(now);

  const countryCode = (sportKey='') => {
    const parts = sportKey.split('_');
    return parts[1] ? parts[1].slice(0,2).toUpperCase() : 'GL';
  };

  const bestOutcomes = (event) => {
    const bookmakers = Array.isArray(event.bookmakers) ? event.bookmakers : [];
    for (const bookmaker of bookmakers) {
      const markets = Array.isArray(bookmaker.markets) ? bookmaker.markets : [];
      const h2h = markets.find(m => m.key === 'h2h');
      if (h2h && Array.isArray(h2h.outcomes) && h2h.outcomes.length >= 2) return h2h.outcomes;
    }
    return [];
  };

  const outcomeByName = (outcomes, name) => outcomes.find(o => normalize(o.name) === normalize(name));
  const drawOutcome = (outcomes) => outcomes.find(o => normalize(o.name) === 'draw');

  const buildPrediction = (event) => {
    const outcomes = bestOutcomes(event);
    const home = outcomeByName(outcomes, event.home_team);
    const away = outcomeByName(outcomes, event.away_team);
    const draw = drawOutcome(outcomes);
    const homeOdds = Number(home?.price || 0);
    const awayOdds = Number(away?.price || 0);
    const drawOdds = Number(draw?.price || 0);
    let hp = homeOdds > 1 ? 1/homeOdds : 0;
    let ap = awayOdds > 1 ? 1/awayOdds : 0;
    let dp = drawOdds > 1 ? 1/drawOdds : 0;
    const total = hp + ap + dp || 1;
    hp = Math.round((hp/total)*100);
    ap = Math.round((ap/total)*100);
    dp = Math.max(0, 100 - hp - ap);

    const strongest = Math.max(hp, dp, ap);
    let pick = event.home_team;
    let side = 'H';
    let odds = homeOdds || 1.70;
    let analysis = 'Rynek przedmeczowy wspiera gospodarzy.';
    if (strongest === ap) {
      pick = event.away_team; side = 'A'; odds = awayOdds || 1.80;
      analysis = 'Model daje przewagę gościom na podstawie wyceny rynku.';
    } else if (strongest === dp) {
      pick = 'Remis'; side = 'D'; odds = drawOdds || 3.10;
      analysis = 'Wyrównany mecz i podbity scenariusz remisu.';
    } else {
      analysis = 'Najwyższe prawdopodobieństwo po stronie gospodarzy.';
    }

    return {
      homeProb: hp,
      drawProb: dp,
      awayProb: ap,
      confidence: strongest,
      pick,
      side,
      odds: Number(odds || 1.7).toFixed(2),
      valuePct: Math.max(3, Math.min(12, Math.round((strongest - 33) / 3 + 4))),
      analysis
    };
  };

  const settle = (prediction, scoreEvent, eventStartIso) => {
    if (scoreEvent && scoreEvent.completed && Array.isArray(scoreEvent.scores)) {
      const homeScore = Number(scoreEvent.scores.find(s => normalize(s.name) === normalize(scoreEvent.home_team))?.score);
      const awayScore = Number(scoreEvent.scores.find(s => normalize(s.name) === normalize(scoreEvent.away_team))?.score);
      if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
        let won = false;
        if (prediction.side === 'H') won = homeScore > awayScore;
        else if (prediction.side === 'A') won = awayScore > homeScore;
        else won = homeScore === awayScore;
        const odds = Number(prediction.odds);
        const profit = won ? Number((stake * (odds - 1)).toFixed(2)) : -stake;
        return {
          settled:true,
          result: won ? 'WIN' : 'LOSS',
          profit,
          statusText: won ? 'WIN' : 'LOSS',
          statusClass: won ? 'win' : 'loss',
          scoreText: `${homeScore}:${awayScore}`
        };
      }
    }

    const start = new Date(eventStartIso).getTime();
    const nowTs = Date.now();
    if (start <= nowTs) {
      return { settled:false, result:'LIVE', profit:0, statusText:'LIVE', statusClass:'live' };
    }
    return { settled:false, result:'PRE', profit:0, statusText:'PRE', statusClass:'pre' };
  };

  try {
    const sports = await json(`https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`);
    const soccerKeys = (Array.isArray(sports) ? sports : [])
      .filter(s => s && s.active && String(s.key || '').startsWith('soccer_') && !String(s.key || '').includes('winner'))
      .map(s => s.key);

    const fetchOddsForKey = async (key) => {
      try {
        return await json(`https://api.the-odds-api.com/v4/sports/${key}/odds/?apiKey=${apiKey}&regions=uk&markets=h2h&oddsFormat=decimal&dateFormat=iso`);
      } catch {
        return [];
      }
    };
    const fetchScoresForKey = async (key) => {
      try {
        return await json(`https://api.the-odds-api.com/v4/sports/${key}/scores/?apiKey=${apiKey}&daysFrom=2&dateFormat=iso`);
      } catch {
        return [];
      }
    };

    const oddsChunks = await Promise.all(soccerKeys.map(fetchOddsForKey));
    const allOdds = oddsChunks.flat().filter(ev => Array.isArray(ev.bookmakers) && ev.bookmakers.length);

    let oddsEvents = allOdds.filter(ev => dayKey(ev.commence_time) === localToday);

    // Fallback: if no Warsaw-today matches yet, show nearest upcoming + recent events so dashboard isn't empty after midnight.
    if (!oddsEvents.length) {
      oddsEvents = allOdds
        .filter(ev => new Date(ev.commence_time).getTime() >= Date.now() - 6 * 60 * 60 * 1000)
        .sort((a,b) => new Date(a.commence_time) - new Date(b.commence_time))
        .slice(0, 25);
    }

    const usedKeys = [...new Set((oddsEvents.length ? oddsEvents : allOdds).map(ev => ev.sport_key))];
    const scoresChunks = await Promise.all(usedKeys.map(fetchScoresForKey));
    const scoresMap = new Map(scoresChunks.flat().map(ev => [ev.id, ev]));

    const matches = oddsEvents
      .map(ev => {
        const pred = buildPrediction(ev);
        const settlement = settle(pred, scoresMap.get(ev.id), ev.commence_time);
        const start = new Date(ev.commence_time);
        const diff = start.getTime() - Date.now();
        let startLabel = 'Start';
        if (diff > 0) {
          const mins = Math.floor(diff / 60000);
          if (mins < 60) startLabel = `${mins}m`;
          else {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            startLabel = m ? `${h}h ${m}m` : `${h}h`;
          }
        } else if (settlement.result === 'LIVE') {
          startLabel = 'LIVE';
        }
        return {
          id: ev.id,
          country: countryCode(ev.sport_key),
          league: ev.sport_title,
          home: ev.home_team,
          away: ev.away_team,
          timeLocal: start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE }),
          dateLocal: start.toLocaleDateString('pl-PL', { timeZone: APP_TIMEZONE }),
          startLabel,
          ...pred,
          value: `+${pred.valuePct}%`,
          commenceTime: ev.commence_time,
          stake,
          ...settlement
        };
      })
      .sort((a,b) => new Date(a.commenceTime) - new Date(b.commenceTime));

    const settledMatches = matches.filter(m => m.settled);
    const wins = settledMatches.filter(m => m.result === 'WIN');
    const profit = settledMatches.reduce((a,m) => a + m.profit, 0);
    const stakeTotal = settledMatches.length * stake;
    const roi = stakeTotal ? Math.round((profit / stakeTotal) * 100) : 0;
    const avgConfidence = matches.length ? Math.round(matches.reduce((a,m)=>a+m.confidence,0)/matches.length) : 0;

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      body: JSON.stringify({
        today: localToday,
        fallbackUsed: !allOdds.filter(ev => dayKey(ev.commence_time) === localToday).length,
        matches,
        stats: {
          total: matches.length,
          settled: settledMatches.length,
          wins: wins.length,
          winRate: settledMatches.length ? Math.round((wins.length / settledMatches.length) * 100) : 0,
          avgConfidence,
          profit,
          roi
        }
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'dashboard_backend_failed', message: err.message || 'unknown_error' })
    };
  }
};
