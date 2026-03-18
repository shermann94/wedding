const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU";

const client = supabase.createClient(supabaseUrl, supabaseKey);

// ===============================
// HELPERS
// ===============================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getPlayerKey(name, tableNo) {
  return `${normalizeText(name)}::${tableNo}`;
}

function showNoWinnerCard() {
  document.getElementById("winner-card").style.display = "block";
  document.getElementById("winner-answer").innerText = "";
  document.getElementById("winner-player").innerText = "";
  document.getElementById("winner-reason").innerText =
    "There are no eligible winners this round.";
}

// ===============================
// LOAD GAME
// ===============================

async function loadGame() {
  try {
    const { data, error } = await client
      .from("game_state")
      .select("*")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.error("Failed to load game:", error);
      return;
    }

    const roomCode = data.room_code || "";
    const formattedCode =
      roomCode.length >= 8
        ? roomCode.slice(0, 4) + "-" + roomCode.slice(4)
        : roomCode;

    document.getElementById("room-code").innerText = formattedCode || "----";
    document.getElementById("scenario").innerText =
      data.scenario || "Waiting for round to start...";

    setPhaseUI(data.phase);
    await updatePlayerCount();
    await updateAnswerCount();

    if (data.phase === "results") {
      await loadWinnerForRound(data.round_number);
    }
  } catch (err) {
    console.error("Unexpected loadGame error:", err);
  }
}

// Run this function when the page loads
loadGame();

// ===============================
// UI STATE
// ===============================

function setPhaseUI(phase) {
  const lobby = document.getElementById("lobby");
  const scenarioCard = document.getElementById("scenario-card");
  const winnerCard = document.getElementById("winner-card");

  const startBtn = document.getElementById("start-game-btn");
  const evaluateBtn = document.getElementById("evaluate-btn");
  const nextBtn = document.getElementById("next-round-btn");
  const resetBtn = document.getElementById("reset-btn");
  const leaderboardBtn = document.getElementById("leaderboard-btn");

  leaderboardBtn.style.display = "none";

  if (phase === "waiting") {
    lobby.style.display = "block";
    scenarioCard.style.display = "none";
    winnerCard.style.display = "none";

    startBtn.style.display = "inline-block";
    evaluateBtn.style.display = "none";
    nextBtn.style.display = "none";
    resetBtn.style.display = "none";
  } else if (phase === "answering") {
    lobby.style.display = "none";
    scenarioCard.style.display = "block";
    winnerCard.style.display = "none";

    startBtn.style.display = "none";
    evaluateBtn.style.display = "inline-block";
    nextBtn.style.display = "inline-block";
    resetBtn.style.display = "inline-block";
  } else if (phase === "judging") {
    lobby.style.display = "none";
    scenarioCard.style.display = "block";
    winnerCard.style.display = "none";

    startBtn.style.display = "none";
    evaluateBtn.style.display = "none";
    nextBtn.style.display = "none";
    resetBtn.style.display = "inline-block";
  } else if (phase === "results") {
    lobby.style.display = "none";
    scenarioCard.style.display = "block";
    winnerCard.style.display = "block";

    startBtn.style.display = "none";
    evaluateBtn.style.display = "none";
    nextBtn.style.display = "inline-block";
    resetBtn.style.display = "inline-block";
  }
}

// ===============================
// PLAYER COUNT
// ===============================

async function updatePlayerCount() {
  try {
    const { count, error } = await client
      .from("players")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Player count error:", error);
      return;
    }

    document.getElementById("player-count").innerText =
      (count ?? 0) + " / 100 players joined";
  } catch (err) {
    console.error("Unexpected player count error:", err);
  }
}

client
  .channel("players-channel")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "players" },
    async () => {
      await updatePlayerCount();
      await updateAnswerCount();
    },
  )
  .subscribe();

// ===============================
// REALTIME GAME STATE FEED
// ===============================

client
  .channel("game_state_updates")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "game_state" },
    async (payload) => {
      const phase = payload.new.phase;

      document.getElementById("scenario").innerText =
        payload.new.scenario || "Waiting for round to start...";

      setPhaseUI(phase);
      await updateAnswerCount();

      if (phase === "results") {
        await loadWinnerForRound(payload.new.round_number);
      } else {
        document.getElementById("winner-card").style.display = "none";
      }

      if (phase === "waiting") {
        document.getElementById("answers").innerHTML = "";
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
      try {
        const answer = payload.new.answer;

        const { data: game, error } = await client
          .from("game_state")
          .select("round_number, phase")
          .eq("id", 1)
          .single();

        if (error || !game) {
          console.error("Failed to load game for answer feed:", error);
          return;
        }

        if (
          payload.new.round_number === game.round_number &&
          game.phase === "answering"
        ) {
          spawnAnswerBubble(answer);
          await updateAnswerCount();
        }
      } catch (err) {
        console.error("Answer feed error:", err);
      }
    },
  )
  .subscribe();

// ===============================
// HOST CONTROL FUNCTIONS
// ===============================

async function startGame() {
  try {
    const { data: scenarioData, error: scenarioError } = await client
      .from("scenarios")
      .select("*")
      .eq("round_number", 1)
      .maybeSingle();

    if (scenarioError || !scenarioData) {
      console.error("Failed to load round 1 scenario:", scenarioError);
      alert("Failed to load round 1 scenario.");
      return;
    }

    const { error } = await client
      .from("game_state")
      .update({
        round_number: 1,
        phase: "answering",
        scenario: scenarioData.scenario,
      })
      .eq("id", 1);

    if (error) {
      console.error("Start game error:", error);
      alert("Failed to start game: " + error.message);
      return;
    }

    document.getElementById("answers").innerHTML = "";
    document.getElementById("leaderboard-card").style.display = "none";
    await updateAnswerCount();
  } catch (err) {
    console.error("Unexpected startGame error:", err);
  }
}

async function nextRound() {
  try {
    document.getElementById("winner-card").style.display = "none";
    document.getElementById("winner-answer").innerText = "";
    document.getElementById("winner-player").innerText = "";
    document.getElementById("winner-reason").innerText = "";

    const { data: game, error: gameError } = await client
      .from("game_state")
      .select("*")
      .eq("id", 1)
      .single();

    if (gameError || !game) {
      console.error("Failed to load game for next round:", gameError);
      alert("Failed to load current round.");
      return;
    }

    const nextRoundNumber = game.round_number + 1;

    if (nextRoundNumber > 5) {
      document.getElementById("leaderboard-btn").style.display = "inline-block";
      return;
    }

    const { data: scenarioData, error: scenarioError } = await client
      .from("scenarios")
      .select("*")
      .eq("round_number", nextRoundNumber)
      .maybeSingle();

    if (scenarioError || !scenarioData) {
      console.error("Failed to load next scenario:", scenarioError);
      alert("Failed to load next round scenario.");
      return;
    }

    const { error: updateError } = await client
      .from("game_state")
      .update({
        round_number: nextRoundNumber,
        phase: "answering",
        scenario: scenarioData.scenario,
      })
      .eq("id", 1);

    if (updateError) {
      console.error("Next round update error:", updateError);
      alert("Failed to start next round: " + updateError.message);
      return;
    }

    const { error: deleteError } = await client
      .from("answers")
      .delete()
      .gt("id", 0);

    if (deleteError) {
      console.error("Failed to clear answers:", deleteError);
      alert("Round changed, but failed to clear answers.");
    }

    document.getElementById("answers").innerHTML = "";
    await updateAnswerCount();
  } catch (err) {
    console.error("Unexpected nextRound error:", err);
  }
}

// ===============================
// RESET GAME
// ===============================

async function resetGame() {
  try {
    const { error: stateError } = await client
      .from("game_state")
      .update({
        phase: "waiting",
        round_number: 1,
        scenario: "Waiting for round to start...",
      })
      .eq("id", 1);

    if (stateError) {
      console.error("Reset game_state error:", stateError);
      alert("Failed to reset game state: " + stateError.message);
      return;
    }

    const { error: answersError } = await client
      .from("answers")
      .delete()
      .not("id", "is", null);

    if (answersError) {
      console.error("Reset answers error:", answersError);
    }

    const { error: playersError } = await client
      .from("players")
      .delete()
      .not("id", "is", null);

    if (playersError) {
      console.error("Reset players error:", playersError);
    }

    const { error: winnersError } = await client
      .from("winners")
      .delete()
      .not("id", "is", null);

    if (winnersError) {
      console.error("Reset winners error:", winnersError);
    }

    document.getElementById("answers").innerHTML = "";
    document.getElementById("winner-card").style.display = "none";
    document.getElementById("winner-answer").innerText = "";
    document.getElementById("winner-player").innerText = "";
    document.getElementById("winner-reason").innerText = "";
    document.getElementById("leaderboard-card").style.display = "none";

    await loadGame();
  } catch (err) {
    console.error("Unexpected resetGame error:", err);
  }
}

// ===============================
// Spawn bubbles
// ===============================

function spawnAnswerBubble(text) {
  const bubble = document.createElement("div");
  bubble.className = "answer-item";

  bubble.innerText = text;

  bubble.style.left = Math.random() * 70 + "%";
  bubble.style.top = Math.random() * 60 + "%";

  document.getElementById("answers").appendChild(bubble);

  setTimeout(() => {
    if (bubble.parentNode) {
      bubble.remove();
    }
  }, 4000);
}

// ===============================
// UPDATE ANSWER COUNT
// ===============================

async function updateAnswerCount() {
  try {
    const { data: game, error: gameError } = await client
      .from("game_state")
      .select("round_number, phase")
      .eq("id", 1)
      .single();

    if (gameError || !game) {
      console.error("Answer count game state error:", gameError);
      return;
    }

    if (game.phase === "waiting") {
      document.getElementById("answer-count").style.display = "none";
      return;
    }

    document.getElementById("answer-count").style.display = "block";

    const round = game.round_number;

    const { count: playerCount, error: playerError } = await client
      .from("players")
      .select("*", { count: "exact", head: true });

    if (playerError) {
      console.error("Player count error:", playerError);
      return;
    }

    const { count: answerCount, error: answerError } = await client
      .from("answers")
      .select("*", { count: "exact", head: true })
      .eq("round_number", round);

    if (answerError) {
      console.error("Answer count error:", answerError);
      return;
    }

    document.getElementById("answer-count").innerText =
      (answerCount ?? 0) + " / " + (playerCount ?? 0) + " answers received";
  } catch (err) {
    console.error("Unexpected updateAnswerCount error:", err);
  }
}

// ===============================
// LEADERBOARD
// ===============================

async function showLeaderboard() {
  try {
    const { data, error } = await client
      .from("winners")
      .select("*")
      .order("round_number", { ascending: true });

    if (error) {
      console.error("Leaderboard error:", error);
      alert("Failed to load leaderboard.");
      return;
    }

    const list = document.getElementById("leaderboard-list");
    list.innerHTML = "";

    (data || []).forEach((winner) => {
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
  } catch (err) {
    console.error("Unexpected leaderboard error:", err);
  }
}

// ===============================
// LOAD WINNER FOR ROUND
// ===============================

async function loadWinnerForRound(round) {
  try {
    const { data, error } = await client
      .from("winners")
      .select("*")
      .eq("round_number", round)
      .maybeSingle();

    if (error) {
      console.error("Load winner error:", error);
      return;
    }

    if (!data) {
      return;
    }

    document.getElementById("winner-card").style.display = "block";
    document.getElementById("winner-answer").innerText = `"${data.answer}"`;
    document.getElementById("winner-player").innerText =
      `— ${data.player_name} (Table ${data.table_no})`;
    document.getElementById("winner-reason").innerText =
      `🤖 AI Judge: ${data.reason || "No reason provided."}`;
  } catch (err) {
    console.error("Unexpected loadWinnerForRound error:", err);
  }
}

// ===============================
// EVALUATE ANSWERS
// ===============================

async function evaluateAnswers() {
  console.log("Evaluating answers with AI...");

  try {
    const { data: game, error: gameError } = await client
      .from("game_state")
      .select("round_number, scenario, phase")
      .eq("id", 1)
      .single();

    if (gameError || !game) {
      console.error("Failed to load game state:", gameError);
      alert("Failed to load game state.");
      return null;
    }

    const round = game.round_number;

    const { data: answerRows, error: answersError } = await client
      .from("answers")
      .select("name, answer, table_no")
      .eq("round_number", round)
      .order("id", { ascending: true });

    if (answersError) {
      console.error("Failed to load answers:", answersError);
      alert("Failed to load answers.");
      return null;
    }

    const allAnswers = (answerRows || [])
      .map((row) => ({
        name: row.name?.trim(),
        answer: row.answer?.trim(),
        table_no: row.table_no,
      }))
      .filter((row) => row.name && row.answer && row.table_no != null)
      .filter((row) => row.answer !== "{}")
      .filter((row) => row.answer.length > 5);

    console.log("Current answers:", allAnswers);

    if (allAnswers.length === 0) {
      alert("No valid answers to judge.");
      return null;
    }

    let answersForAI = allAnswers;

    const { data: winnerRows, error: winnersError } = await client
      .from("winners")
      .select("player_name, table_no");

    if (!winnersError && Array.isArray(winnerRows)) {
      const previousWinnerKeys = new Set(
        winnerRows.map((row) => getPlayerKey(row.player_name, row.table_no)),
      );

      const eligibleAnswers = allAnswers.filter(
        (row) => !previousWinnerKeys.has(getPlayerKey(row.name, row.table_no)),
      );

      console.log("Eligible answers:", eligibleAnswers);
      answersForAI = eligibleAnswers;
    } else if (winnersError) {
      console.error("Failed to load previous winners:", winnersError);
    }

    if (answersForAI.length === 0) {
      const { error: resultsPhaseError } = await client
        .from("game_state")
        .update({ phase: "results" })
        .eq("id", 1);

      if (resultsPhaseError) {
        console.error("Failed to update results phase:", resultsPhaseError);
        alert("No eligible winner found, but failed to update game phase.");
        return null;
      }

      showNoWinnerCard();

      return;
    }

    const { error: phaseError } = await client
      .from("game_state")
      .update({ phase: "judging" })
      .eq("id", 1);

    if (phaseError) {
      console.error("Failed to update phase:", phaseError);
      alert("Failed to enter judging phase.");
      return null;
    }

    const payload = {
      scenario: game.scenario,
      answers: answersForAI.map((a) => a.answer),
    };

    let response;
    let result;

    try {
      response = await fetch("/api/test-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      result = await response.json();
    } catch (err) {
      console.error("Failed to call AI:", err);
      alert("AI failed to judge answers.");

      await client
        .from("game_state")
        .update({ phase: "answering" })
        .eq("id", 1);

      return null;
    }

    console.log("AI result:", result);

    const winnerIndex = Number(result?.winner_index);

    if (!response.ok || !Number.isInteger(winnerIndex)) {
      console.error("AI response invalid:", result);
      alert("AI failed to judge answers.");

      await client
        .from("game_state")
        .update({ phase: "answering" })
        .eq("id", 1);

      return null;
    }

    const winner = answersForAI[winnerIndex];

    if (!winner) {
      console.error("Winner index invalid:", winnerIndex);
      alert("AI returned an invalid winner.");

      await client
        .from("game_state")
        .update({ phase: "answering" })
        .eq("id", 1);

      return null;
    }

    const { error: winnerSaveError } = await client.from("winners").insert([
      {
        round_number: round,
        player_name: winner.name,
        table_no: winner.table_no,
        answer: winner.answer,
        reason: result.reason || "No reason provided.",
      },
    ]);

    if (winnerSaveError) {
      console.error("Failed to save winner:", winnerSaveError);
      alert("Winner chosen, but failed to save to database.");

      await client
        .from("game_state")
        .update({ phase: "answering" })
        .eq("id", 1);

      return null;
    }

    const { error: resultsPhaseError } = await client
      .from("game_state")
      .update({ phase: "results" })
      .eq("id", 1);

    if (resultsPhaseError) {
      console.error("Failed to update results phase:", resultsPhaseError);
      alert("Winner chosen, but failed to update game phase.");
      return null;
    }

    await loadWinnerForRound(round);

    console.log("Winning player:", winner.name);
    console.log("Winning table:", winner.table_no);
    console.log("Winning answer:", winner.answer);
    console.log("Winning reason:", result.reason);

    return;
  } catch (err) {
    console.error("Unexpected evaluateAnswers error:", err);
    alert("Something went wrong during evaluation.");
    return null;
  }
}
