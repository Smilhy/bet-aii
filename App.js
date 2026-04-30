async function loadMatches() {
  const statusEl = document.getElementById("status");
  const matchesEl = document.getElementById("matches");

  try {
    statusEl.innerText = "Ładowanie...";

    const res = await fetch("/.netlify/functions/getMatches");
    const data = await res.json();

    statusEl.innerText = "Status: " + data.status;

    if (!data.matches || data.matches.length === 0) {
      matchesEl.innerHTML = "Brak meczów ❌";
      return;
    }

    matchesEl.innerHTML = data.matches.map(match => {
      const prediction = getPrediction(match);

      return `
        <div class="card">
          <b>${match.home}</b> vs <b>${match.away}</b><br/>
          <small>${match.time || ""}</small><br/>
          <span>🤖 Typ: ${prediction.tip}</span><br/>
          <span>📊 Confidence: ${prediction.confidence}%</span>
        </div>
      `;
    }).join("");

  } catch (err) {
    statusEl.innerText = "Błąd połączenia ❌";
    matchesEl.innerText = err.message;
  }
}

function getPrediction(match) {
  // prosty "AI"
  const rand = Math.random();

  if (rand < 0.33) return { tip: match.home, confidence: 65 + Math.floor(Math.random()*20) };
  if (rand < 0.66) return { tip: "Draw", confidence: 50 + Math.floor(Math.random()*20) };
  return { tip: match.away, confidence: 65 + Math.floor(Math.random()*20) };
}

loadMatches();
