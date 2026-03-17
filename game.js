// URL of your Supabase project
const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";

// URL of your Supabase project
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU";

// Create Supabase client
const client = supabase.createClient(supabaseUrl, supabaseKey);

// ==============================
// CONFIG
// ==============================

const MAX_ROUNDS = 5;
let currentRound = 1;
let roomCode = "";
let answers = [];
let players = [];

// ==============================
// START GAME
// ==============================

async function startGame() {
  currentRound = 1;

  document.getElementById("start-btn").style.display = "none";
  document.getElementById("evaluate-btn").style.display = "inline-block";
  document.getElementById("next-btn").style.display = "none";

  loadScenario();
}

// ==============================
// LOAD SCENARIO
// ==============================

async function loadScenario() {
  clearUI();

  const { data } = await supabase
    .from("scenarios")
    .select("*")
    .eq("round_number", currentRound)
    .single();

  document.getElementById("scenario-text").innerText = data.scenario;

  // show scenario card
  document.querySelector(".scenario-card").style.display = "block";

  // listen for answers
  listenForAnswers();
}

// ==============================
// LISTEN FOR ANSWERS
// ==============================

function listenForAnswers() {
  supabase
    .channel("answers")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "answers",
        filter: `round_number=eq.${currentRound}`,
      },
      (payload) => {
        const answer = payload.new;
        answers.push(answer);

        spawnBubble(answer);
      }
    )
    .subscribe();
}

// ==============================
// FLOATING SPEECH BUBBLES
// ==============================

function spawnBubble(answer) {
  const container = document.querySelector(".answers-box");

  const el = document.createElement("div");
  el.className = "answer-item";
  el.innerText = answer.answer;

  // random position
  el.style.left = Math.random() * 80 + "%";
  el.style.top = Math.random() * 70 + "%";

  container.appendChild(el);

  setTimeout(() => el.remove(), 4000);
}

// ==============================
// EVALUATE ANSWERS (AI)
// ==============================

async function evaluateAnswers() {
  if (answers.length === 0) return;

  document.getElementById("evaluate-btn").style.display = "none";

  // call your AI API (replace with your endpoint)
  const res = await fetch("/api/evaluate", {
    method: "POST",
    body: JSON.stringify({ answers }),
  });

  const result = await res.json();

  const winner = result.winner;
  const explanation = result.explanation;

  showWinner(winner, explanation);

  // save to DB
  await supabase.from("winners").insert([
    {
      round_number: currentRound,
      player_name: winner.name,
      table_no: winner.table_no,
    },
  ]);

  document.getElementById("next-btn").style.display = "inline-block";
}

// ==============================
// SHOW WINNER CARD
// ==============================

function showWinner(winner, explanation) {
  const container = document.getElementById("winner-card");

  container.style.display = "block";

  container.innerHTML = `
    <h2>🏆 Winner</h2>
    <p><strong>${winner.name}</strong> (Table ${winner.table_no})</p>
    <p>${winner.answer}</p>
    <p id="winner-reason">${explanation}</p>
  `;
}

// ==============================
// NEXT ROUND
// ==============================

function nextRound() {
  currentRound++;

  if (currentRound > MAX_ROUNDS) {
    showLeaderboard();
    return;
  }

  document.getElementById("evaluate-btn").style.display = "inline-block";
  document.getElementById("next-btn").style.display = "none";

  loadScenario();
}

// ==============================
// LEADERBOARD
// ==============================

async function showLeaderboard() {
  const { data } = await supabase
    .from("winners")
    .select("*")
    .order("round_number", { ascending: true });

  const container = document.getElementById("leaderboard");

  container.style.display = "block";

  container.innerHTML = "<h2>🏆 Leaderboard</h2>";

  data.forEach((row) => {
    const p = document.createElement("p");
    p.innerText = `Round ${row.round_number} — Table ${row.table_no} (${row.player_name})`;
    container.appendChild(p);
  });
}

// ==============================
// RESET GAME
// ==============================

function resetGame() {
  currentRound = 1;
  answers = [];

  document.getElementById("start-btn").style.display = "inline-block";
  document.getElementById("evaluate-btn").style.display = "none";
  document.getElementById("next-btn").style.display = "none";

  document.getElementById("winner-card").style.display = "none";
  document.getElementById("leaderboard").style.display = "none";

  clearUI();
}

// ==============================
// CLEAR UI
// ==============================

function clearUI() {
  document.querySelector(".answers-box").innerHTML = "";
  document.getElementById("winner-card").style.display = "none";
}
