// URL of your Supabase project
const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";

// URL of your Supabase project
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU";

// Create a Supabase client so we can read/write database
const client = supabase.createClient(supabaseUrl, supabaseKey);

// ===============================
// LOAD GAME DATA
// ===============================

async function loadGame() {
  // get current game state
  const { data, error } = await client
    .from("game_state")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  // format room code
  const formattedCode =
    data.room_code.slice(0, 4) + "-" + data.room_code.slice(4);

  // show room code
  document.getElementById("room-code").innerText = formattedCode;

  // update player + answer counters
  updatePlayerCount();
  updateAnswerCount();

  // control scenario visibility
  if (data.phase === "answering") {
<<<<<<< HEAD
    document.getElementById("scenario-card").style.display = "block";

    document.getElementById("scenario").innerText = data.scenario;
  } else {
    document.getElementById("scenario-card").style.display = "none";
=======

  document.getElementById("lobby").style.display = "none";

  document.getElementById("scenario-card").style.display = "block";
  document.getElementById("scenario").innerText = data.scenario;

} else {

  document.getElementById("lobby").style.display = "block";

  document.getElementById("scenario-card").style.display = "none";
}

  //resetting of the button state
  if (data.phase === "waiting") {

  document.getElementById("start-game-btn").style.display = "inline-block"
  document.getElementById("evaluate-btn").style.display = "none"
  document.getElementById("next-round-btn").style.display = "none"
  document.getElementById("reset-btn").style.display = "none"
  document.getElementById("winner-card").style.display = "none";


  } else if (data.phase === "answering") {

  document.getElementById("start-game-btn").style.display = "none"
  document.getElementById("evaluate-btn").style.display = "inline-block"
  document.getElementById("next-round-btn").style.display = "inline-block"
  document.getElementById("reset-btn").style.display = "inline-block"

>>>>>>> c4a2df5 (initial clean commit)
  }
}

// Run this function when the page loads
loadGame();

// ===============================
// UPDATE PLAYER COUNT
// ===============================

// This function counts how many players joined
// and updates the lobby display
async function updatePlayerCount() {
  // Ask Supabase for the total number of players
  const { count } = await client
    .from("players")
    .select("*", { count: "exact", head: true });

  // Update the text on the screen
  document.getElementById("player-count").innerText =
    count + " / 100 players joined";
}

// ===============================
// REALTIME PLAYER JOIN LISTENER
// ===============================

// Subscribe to realtime database changes
// whenever someone joins the game
client
  .channel("players-channel")
  .on(
    "postgres_changes",
    {
      event: "INSERT", // Trigger when a new row is added
      schema: "public",
      table: "players",
    },
    (payload) => {
      // Update the lobby player count
      updatePlayerCount();
    },
  )
  .subscribe();

// ===============================
// REALTIME ANSWER FEED
// ===============================

// Listen for new answers submitted by players
client
  .channel("game_state_updates")
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "game_state",
    },
    (payload) => {
      if (payload.new.phase === "answering") {
        document.getElementById("scenario-card").style.display = "block";
        document.getElementById("scenario").innerText = payload.new.scenario;
      }

      if (payload.new.phase === "waiting") {
        document.getElementById("scenario-card").style.display = "none";
      }
    },
  )
  .subscribe();

// ===============================
// REALTIME ANSWER FEED
// ===============================
console.log("Listening for answers...");

client
  .channel("answers-channel")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "answers",
    },
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
    },
  )
  .subscribe();

// ===============================
// HOST CONTROL FUNCTIONS
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
<<<<<<< HEAD
}

async function nextRound() {
=======

  document.getElementById("start-game-btn").style.display = "none";
  document.getElementById("evaluate-btn").style.display = "inline-block";
  document.getElementById("next-round-btn").style.display = "inline-block";
  document.getElementById("reset-btn").style.display = "inline-block";

  document.getElementById("lobby").style.display = "none";
}

async function nextRound() {

// hide previous winner card
document.getElementById("winner-card").style.display = "none";

>>>>>>> c4a2df5 (initial clean commit)
  // get current game state
  const { data } = await client
    .from("game_state")
    .select("*")
    .eq("id", 1)
    .single();

  const nextRound = data.round_number + 1;
<<<<<<< HEAD
=======
  if(nextRound > 5){
  document.getElementById("leaderboard-btn").style.display = "inline-block";
  return;
}
>>>>>>> c4a2df5 (initial clean commit)

  // get scenario for next round
  const { data: scenarioData } = await client
    .from("scenarios")
    .select("*")
    .eq("round_number", nextRound)
    .maybeSingle();

  if (!scenarioData) {
    alert("No more rounds!");
    return;
  }

  // update game state
  await client
    .from("game_state")
    .update({
      round_number: nextRound,
      phase: "answering",
      scenario: scenarioData.scenario,
    })
    .eq("id", 1);

  // clear previous answers
  await client.from("answers").delete().gt("id", 0);

  // clear bubbles
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

<<<<<<< HEAD
=======
  // get player's table number
const { data: player } = await client
  .from("players")
  .select("table_no")
  .eq("name", winner.name)
  .single();

// save winner to database
await client.from("winners").upsert([
  {
    round_number: round,
    player_name: winner.name,
    table_no: player.table_no,
    answer: winner.answer
  }
], { onConflict: "round_number" });

  // show winner card
document.getElementById("winner-card").style.display = "block";

document.getElementById("winner-answer").innerText =
"\"" + winner.answer + "\"";

document.getElementById("winner-player").innerText =
"— " + winner.name;

document.getElementById("winner-reason").innerText =
"🤖 AI Judge: " + result.reason;

>>>>>>> c4a2df5 (initial clean commit)
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

<<<<<<< HEAD
async function resetGame() {
  await client
    .from("game_state")
    .update({
      phase: "waiting",
      round_number: 1,
      scenario: "Waiting for round to start...",
    })
    .eq("id", 1);

  // delete all answers
  await client.from("answers").delete().gt("id", 0);

  // clear bubbles
  document.getElementById("answers").innerHTML = "";

  // reload state
  loadGame();
=======
async function resetGame(){

// reset game state
await client
.from("game_state")
.update({
phase: "waiting",
round_number: 1,
scenario: "Waiting for round to start..."
})
.eq("id",1)


// delete all answers
await client
.from("answers")
.delete()
.not("id","is",null)


// delete all players
await client
.from("players")
.delete()
.not("id","is",null)


// clear bubbles on screen
document.getElementById("answers").innerHTML = ""

// hide winner card
document.getElementById("winner-card").style.display = "none"

// ✅ show Start Game button again
document.getElementById("start-game-btn").style.display = "block"

// hide other buttons
document.getElementById("evaluate-btn").style.display = "none"
document.getElementById("next-round-btn").style.display = "none"
document.getElementById("reset-btn").style.display = "none"

// reload host UI
loadGame()

>>>>>>> c4a2df5 (initial clean commit)
}

// ===============================
// Spawn bubbles
// ===============================
function spawnAnswerBubble(text) {
  const bubble = document.createElement("div");

  bubble.className = "answer-item";

  bubble.innerText = text;

  // random position
<<<<<<< HEAD
  bubble.style.left = Math.random() * 70 + "%";
  bubble.style.top = Math.random() * 60 + "%";
=======
bubble.style.left = Math.random() * 90 + "%";
bubble.style.top = 20 + Math.random() * 70 + "%";
>>>>>>> c4a2df5 (initial clean commit)

  document.getElementById("answers").appendChild(bubble);

  // remove bubble after animation
  setTimeout(() => {
    bubble.remove();
  }, 4000);
}

// ===============================
// UPDATE ANSWER COUNT
// ===============================
async function updateAnswerCount() {
  // get game state
  const { data: game } = await client
    .from("game_state")
    .select("round_number, phase")
    .eq("id", 1)
    .single();

  // hide counter if waiting
  if (game.phase === "waiting") {
    document.getElementById("answer-count").style.display = "none";
    return;
  }

  // show counter otherwise
  document.getElementById("answer-count").style.display = "block";

  const round = game.round_number;

  // count players
  const { count: playerCount } = await client
    .from("players")
    .select("*", { count: "exact", head: true });

  // count answers
  const { count: answerCount } = await client
    .from("answers")
    .select("*", { count: "exact", head: true })
    .eq("round_number", round);

  const players = playerCount ?? 0;
  const answers = answerCount ?? 0;

  document.getElementById("answer-count").innerText =
    answers + " / " + players + " answers received";
}
<<<<<<< HEAD
=======

// ===============================
// Show Leaderboard
// ===============================
async function showLeaderboard(){

const { data } = await client
.from("winners")
.select("*")
.order("round_number", { ascending: true });

const list = document.getElementById("leaderboard-list");
list.innerHTML = "";

data.forEach(winner => {

const row = document.createElement("p");

row.innerText =
"Round " + winner.round_number +
" — Table " + winner.table_no +
" — " + winner.player_name;

list.appendChild(row);

});

document.getElementById("leaderboard-card").style.display = "block";

}
>>>>>>> c4a2df5 (initial clean commit)
