// URL of your Supabase project
const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";

// URL of your Supabase project
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU";

// Create Supabase client
const client = supabase.createClient(supabaseUrl, supabaseKey);

// ===============================
// LOAD GAME DATA
// ===============================

async function loadGame() {
  const { data, error } = await client
    .from("game_state")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  const formattedCode =
    data.room_code.slice(0, 4) + "-" + data.room_code.slice(4);

  document.getElementById("room-code").innerText = formattedCode;

  updatePlayerCount();
  updateAnswerCount();

  // UI control
  if (data.phase === "answering") {
    document.getElementById("lobby").style.display = "none";
    document.getElementById("scenario-card").style.display = "block";
    document.getElementById("scenario").innerText = data.scenario;
  } else {
    document.getElementById("lobby").style.display = "block";
    document.getElementById("scenario-card").style.display = "none";
  }

  // Button states
  if (data.phase === "waiting") {
    document.getElementById("start-game-btn").style.display = "inline-block";
    document.getElementById("evaluate-btn").style.display = "none";
    document.getElementById("next-round-btn").style.display = "none";
    document.getElementById("reset-btn").style.display = "none";
    document.getElementById("winner-card").style.display = "none";
  } else if (data.phase === "answering") {
    document.getElementById("start-game-btn").style.display = "none";
    document.getElementById("evaluate-btn").style.display = "inline-block";
    document.getElementById("next-round-btn").style.display = "inline-block";
    document.getElementById("reset-btn").style.display = "inline-block";
  }
}

loadGame();

// ===============================
// PLAYER COUNT
// ===============================

async function updatePlayerCount() {
  const { count } = await client
    .from("players")
    .select("*", { count: "exact", head: true });

  document.getElementById("player-count").innerText =
    count + " / 100 players joined";
}

// realtime player join
client
  .channel("players-channel")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "players" },
    () => updatePlayerCount()
  )
  .subscribe();

// ===============================
// GAME STATE LISTENER
// ===============================

client
  .channel("game_state_updates")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "game_state" },
    (payload) => {
      if (payload.new.phase === "answering") {
        document.getElementById("scenario-card").style.display = "block";
        document.getElementById("scenario").innerText =
          payload.new.scenario;
      }

      if (payload.new.phase === "waiting") {
        document.getElementById("scenario-card").style.display = "none";
      }
    }
  )
  .subscribe();

// ===============================
// ANSWER FEED
// ===============================

client
  .channel("answers-channel")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "answers" },
    async (payload) => {
      const answer = payload.new.answer;

      const { data: game } = await client
        .from("game_state")
        .select("round_number")
        .eq("id", 1)
        .single();

      if (payload.new.round_number === game.round_number) {
        spawnAnswerBubble(answer);
        updateAnswerCount();
      }
    }
  )
  .subscribe();

// ===============================
// HOST CONTROLS
// ===============================

async function startGame() {
  const { data: scenarioData } = await client
    .from("scenarios")
    .select("*")
    .eq("round_number", 1)
    .maybeSingle();

  await client
    .from("game_state")
    .update({
      round_number: 1,
      phase: "answering",
      scenario: scenarioData.scenario,
    })
    .eq("id", 1);

  document.getElementById("start-game-btn").style.display = "none";
  document.getElementById("evaluate-btn").style.display = "inline-block";
  document.getElementById("next-round-btn").style.display = "inline-block";
  document.getElementById("reset-btn").style.display = "inline-block";

  document.getElementById("lobby").style.display = "none";
}

async function nextRound() {
  document.getElementById("winner-card").style.display = "none";

  const { data } = await client
    .from("game_state")
    .select("*")
    .eq("id", 1)
    .single();

  const nextRound = data.round_number + 1;

  if (nextRound > 5) {
    document.getElementById("leaderboard-btn").style.display =
      "inline-block";
    return;
  }

  const { data: scenarioData } = await client
    .from("scenarios")
    .select("*")
    .eq("round_number", nextRound)
    .maybeSingle();

  await client
    .from("game_state")
    .update({
      round_number: nextRound,
      phase: "answering",
      scenario: scenarioData.scenario,
    })
    .eq("id", 1);

  await client.from("answers").delete().gt("id", 0);

  document.getElementById("answers").innerHTML = "";
}
// ===============================
// use AI later
// ===============================
async function evaluateAnswers() {
  console.log("Evaluating answers with AI...");

  const { data: game, error: gameError } = await client
    .from("game_state")
    .select("round_number, scenario")
    .eq("id", 1)
    .single();

  if (gameError || !game) {
    console.error("Failed to load game state:", gameError);
    alert("Failed to load game state.");
    return null;
  }

  const round = game.round_number;

  const { data, error: answersError } = await client
    .from("answers")
    .select("name, answer")
    .eq("round_number", round)
    .order("id", { ascending: true });

  if (answersError) {
    console.error("Failed to load answers:", answersError);
    alert("Failed to load answers.");
    return null;
  }

  const answers = (data || [])
    .map((row) => ({
      name: row.name?.trim(),
      answer: row.answer?.trim(),
    }))
    .filter((row) => row.answer && row.answer !== "{}")
    .filter((a) => a.answer.length > 5);

  console.log("Current answers:", answers);

  if (answers.length === 0) {
    alert("No valid answers to judge.");
    return null;
  }

  const { error: phaseError } = await client
    .from("game_state")
    .update({
      phase: "judging",
    })
    .eq("id", 1);

  if (phaseError) {
    console.error("Failed to update phase:", phaseError);
    alert("Failed to enter judging phase.");
    return null;
  }

  const payload = {
    scenario: game.scenario,
    answers: answers.map((a) => a.answer),
  };

  const response = await fetch("/api/test-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  console.log("AI result:", result);

  if (
    !response.ok ||
    !result ||
    result.winner_index === undefined ||
    result.winner_index === null
  ) {
    console.error("AI response invalid:", result);
    alert("AI failed to judge answers.");
    return null;
  }

  const winnerIndex = result.winner_index;
  const winner = answers[winnerIndex];
 
  // show winner card
  document.getElementById("winner-card").style.display = "block";

  document.getElementById("winner-answer").innerText =
  "\"" + winner.answer + "\"";

  document.getElementById("winner-player").innerText =
  "— " + winner.name;

   // get player's table number
const { data: player } = await client
  .from("players")
  .select("table_no")
  .eq("name", winner.name)
  .single();

// save winner to database
await client.from("winners").insert([
  {
    round_number: round,
    player_name: winner.name,
    table_no: player.table_no,
    answer: winner.answer
  }
]);

  if (!winner) {
    console.error("Winner index invalid:", winnerIndex);
    alert("AI returned an invalid winner.");
    return null;
  }

  console.log("Winning player:", winner.name);
  console.log("Winning answer:", winner.answer);
  console.log("Winning reason:", result.reason);

  const { error: resultsPhaseError } = await client
    .from("game_state")
    .update({
      phase: "results",
    })
    .eq("id", 1);

  if (resultsPhaseError) {
    console.error("Failed to update results phase:", resultsPhaseError);
    alert("Winner chosen, but failed to update game phase.");
  }

  // TODO: store winner in database for historical tracking, those who have won should not have their responses judged in future rounds
  return {
    scenario: game.scenario,
    winner_name: winner.name,
    winner_answer: winner.answer,
    reason: result.reason,
  };
}
// ===============================
// RESET GAME
// ===============================

async function resetGame() {
  await client
    .from("game_state")
    .update({
      phase: "waiting",
      round_number: 1,
      scenario: "Waiting for round to start...",
    })
    .eq("id", 1);

  await client.from("answers").delete().not("id", "is", null);
  await client.from("players").delete().not("id", "is", null);

  document.getElementById("answers").innerHTML = "";
  document.getElementById("winner-card").style.display = "none";

  document.getElementById("start-game-btn").style.display = "block";
  document.getElementById("evaluate-btn").style.display = "none";
  document.getElementById("next-round-btn").style.display = "none";
  document.getElementById("reset-btn").style.display = "none";

  loadGame();
}

// ===============================
// BUBBLES
// ===============================

function spawnAnswerBubble(text) {
  const bubble = document.createElement("div");

  bubble.className = "answer-item";
  bubble.innerText = text;

  bubble.style.left = Math.random() * 90 + "%";
  bubble.style.top = 20 + Math.random() * 70 + "%";

  document.getElementById("answers").appendChild(bubble);

  setTimeout(() => bubble.remove(), 4000);
}

// ===============================
// ANSWER COUNT
// ===============================

async function updateAnswerCount() {
  const { data: game } = await client
    .from("game_state")
    .select("round_number, phase")
    .eq("id", 1)
    .single();

  if (game.phase === "waiting") {
    document.getElementById("answer-count").style.display = "none";
    return;
  }

  document.getElementById("answer-count").style.display = "block";

  const round = game.round_number;

  const { count: playerCount } = await client
    .from("players")
    .select("*", { count: "exact", head: true });

  const { count: answerCount } = await client
    .from("answers")
    .select("*", { count: "exact", head: true })
    .eq("round_number", round);

  document.getElementById("answer-count").innerText =
    (answerCount ?? 0) + " / " + (playerCount ?? 0) + " answers received";
}

// ===============================
// LEADERBOARD
// ===============================

async function showLeaderboard() {
  const { data } = await client
    .from("winners")
    .select("*")
    .order("round_number", { ascending: true });

  const list = document.getElementById("leaderboard-list");
  list.innerHTML = "";

  data.forEach((winner) => {
    const row = document.createElement("p");

    row.innerText =
      "Round " +
      winner.round_number +
      " — Table " +
      winner.table_no +
      " — " +
      winner.player_name;

    list.appendChild(row);
  });

  document.getElementById("leaderboard-card").style.display = "block";
}
