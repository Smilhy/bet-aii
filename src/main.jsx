import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [tips, setTips] = React.useState([]);

  async function fetchTips() {
    const { data } = await supabase
      .from("tips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setTips(data || []);
  }

  React.useEffect(() => {
    fetchTips();
  }, []);

  async function addTip() {
    await supabase.from("tips").insert([{
      match: "Real Madryt vs Bayern",
      type: "Powyżej 2.5 gola",
      odds: 1.72,
      league: "Liga Mistrzów",
      description: "Testowy typ",
      access: "free",
      ai_probability: 72
    }]);
    fetchTips();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Bet+AI</h1>
      <button onClick={addTip}>Dodaj testowy typ</button>

      <h2>Ostatnie typy</h2>
      {tips.map(tip => (
        <div key={tip.id} style={{border:"1px solid #ddd", margin:10, padding:10}}>
          <b>{tip.match}</b>
          <div>{tip.type}</div>
          <div>Kurs: {tip.odds}</div>
          <div>{tip.league}</div>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);