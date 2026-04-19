const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";
const supabaseKey = "sb_publishable_GprPBK44VLeb-3P7_qgOKA_WBpVkOSq";
const client = supabase.createClient(supabaseUrl, supabaseKey);
window.client = client;

const adminKey = localStorage.getItem("adminKey");

if (!adminKey) {
  window.location.replace("login.html");
}

let currentGameState = {
  round_number: 1,
  phase: "waiting",
  scenario: "Waiting for round to start...",
};

let livePlayerCount = 0;
let isBooting = true;
let isBusy = false;
let hostCountdownInterval = null;

let nextLane = 0;

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getPlayerKey(name, tableCode) {
  return `${normalizeText(name)}::${normalizeText(tableCode)}`;
}

function getControlsEl() {
  return document.querySelector(".controls");
}

function showHostLoading(show) {
  const loading = document.getElementById("host-loading-screen");
  if (!loading) return;
  loading.style.display = show ? "flex" : "none";
}

function setBusy(value, options = {}) {
  isBusy = value;

  const startBtn = document.getElementById("start-game-btn");
  const evaluateBtn = document.getElementById("evaluate-btn");
  const nextBtn = document.getElementById("next-round-btn");
  const resetBtn = document.getElementById("reset-btn");
  const leaderboardBtn = document.getElementById("leaderboard-btn");

  [startBtn, evaluateBtn, nextBtn, resetBtn, leaderboardBtn].forEach((btn) => {
    if (btn) btn.disabled = value;
  });

  if (evaluateBtn) {
    evaluateBtn.innerText =
      value && options.evaluateLoading ? "Judging..." : "Evaluate Answers";
  }

  if (nextBtn) {
    nextBtn.innerText =
      value && options.nextRoundLoading
        ? "Loading Next Round..."
        : "Next Round";
  }

  if (resetBtn) {
    resetBtn.innerText =
      value && options.resetLoading ? "Resetting..." : "Reset Game";
  }

  if (leaderboardBtn) {
    leaderboardBtn.innerText =
      value && options.leaderboardLoading
        ? "Loading Winners..."
        : "Show Winners";
  }

  if (startBtn) {
    startBtn.innerText =
      value && options.startLoading ? "Starting..." : "Start Game";
  }
}

function showWinnerLoading(message = "AI is choosing the funniest answer.") {
  const winnerCard = document.getElementById("winner-card");
  const winnerLoading = document.getElementById("winner-loading");
  const winnerContent = document.getElementById("winner-content");
  const winnerLoadingText = document.getElementById("winner-loading-text");

  if (winnerCard) winnerCard.style.display = "flex";
  if (winnerLoading) winnerLoading.style.display = "flex";
  if (winnerContent) winnerContent.style.display = "none";
  if (winnerLoadingText) winnerLoadingText.innerText = message;
}

function hideWinnerLoading() {
  const winnerLoading = document.getElementById("winner-loading");
  const winnerContent = document.getElementById("winner-content");
  if (winnerLoading) winnerLoading.style.display = "none";
  if (winnerContent) winnerContent.style.display = "block";
}

function showWinnerError(message) {
  hideWinnerLoading();
  document.getElementById("winner-card").style.display = "flex";
  document.getElementById("winner-title").innerText = "⚠️ Judging Failed";
  document.getElementById("winner-answer").innerText = "";
  document.getElementById("winner-player").innerText = "";
  document.getElementById("winner-reason").innerText = message;
}

function clearWinnerCard() {
  hideWinnerLoading();
  document.getElementById("winner-title").innerText = "🏆 Best Marriage Advice";
  document.getElementById("winner-answer").innerText = "";
  document.getElementById("winner-player").innerText = "";
  document.getElementById("winner-reason").innerText = "";
}

function hideAllHostPanels() {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("scenario-card").style.display = "none";
  document.getElementById("winner-card").style.display = "none";
  document.getElementById("leaderboard-card").style.display = "none";
}

function showNoWinnerCard() {
  hideWinnerLoading();
  document.getElementById("winner-card").style.display = "flex";
  document.getElementById("winner-title").innerText = "No Winner This Round";
  document.getElementById("winner-answer").innerText = "";
  document.getElementById("winner-player").innerText = "";
  document.getElementById("winner-reason").innerText =
    "There are no eligible winners this round.";
}

function renderRoundLabel() {
  const el = document.getElementById("round-label");
  if (!el) return;
  el.innerText = `Round ${currentGameState.round_number}`;
}

function setPhaseUI(phase) {
  const playerList = document.getElementById("player-list");

  if (playerList) {
    playerList.style.display = phase === "waiting" ? "grid" : "none";
  }

  const startBtn = document.getElementById("start-game-btn");
  const evaluateBtn = document.getElementById("evaluate-btn");
  const nextBtn = document.getElementById("next-round-btn");
  const resetBtn = document.getElementById("reset-btn");
  const leaderboardBtn = document.getElementById("leaderboard-btn");
  const controls = getControlsEl();

  const playerCountEl = document.getElementById("player-count");
  const timerEl = document.getElementById("host-timer");
  const roundLabelEl = document.getElementById("round-label");

  // ✅ FIX: CONTROL TIMER IMMEDIATELY
  if (timerEl) {
    if (phase === "answering") {
      timerEl.style.display = "flex";
    } else {
      timerEl.style.display = "none";
      timerEl.innerText = "";
    }
  }

  // ✅ FIX: CONTROL ROUND LABEL IMMEDIATELY
  if (roundLabelEl) {
    if (phase === "answering") {
      roundLabelEl.style.display = "flex";
    } else {
      roundLabelEl.style.display = "none";
    }
  }

  hideAllHostPanels();
  controls.style.display = "flex";

  startBtn.style.display = "none";
  evaluateBtn.style.display = "none";
  nextBtn.style.display = "none";
  resetBtn.style.display = "none";
  leaderboardBtn.style.display = "none";

  if (phase === "waiting") {
    document.getElementById("lobby").style.display = "block";
    startBtn.style.display = "inline-block";
  } else if (phase === "answering") {
    document.getElementById("scenario-card").style.display = "flex";
    evaluateBtn.style.display = "inline-block";
    resetBtn.style.display = "inline-block";
  } else if (phase === "judging") {
    document.getElementById("scenario-card").style.display = "flex";
    document.getElementById("winner-card").style.display = "flex";
    evaluateBtn.style.display = "inline-block";
    resetBtn.style.display = "inline-block";
  } else if (phase === "results") {
    document.getElementById("scenario-card").style.display = "flex";
    document.getElementById("winner-card").style.display = "flex";
    resetBtn.style.display = "inline-block";

    if (currentGameState.round_number >= 5) {
      leaderboardBtn.style.display = "inline-block";
    } else {
      nextBtn.style.display = "inline-block";
    }
  } else if (phase === "leaderboard") {
    document.getElementById("leaderboard-card").style.display = "block";
    resetBtn.style.display = "inline-block";
  }

  // player count
  if (playerCountEl) {
    playerCountEl.style.display = phase === "waiting" ? "block" : "none";
  }

  renderRoundLabel();
}

async function loadGame() {
  try {
    isBooting = true;
    showHostLoading(true);
    hideAllHostPanels();
    getControlsEl().style.display = "none";
    startBGM();

    const { data, error } = await client
      .from("game_state")
      .select("*")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.error("Failed to load game:", error);
      return;
    }

    currentGameState = {
      round_number: data.round_number,
      phase: data.phase,
      scenario: data.scenario || "Waiting for round to start...",
    };

    const roomCode = data.room_code || "";
    const formattedCode =
      roomCode.length >= 8
        ? roomCode.slice(0, 4) + "-" + roomCode.slice(4)
        : roomCode;

    const bigCode = document.getElementById("room-code-large");
    if (bigCode) {
      bigCode.innerText = formattedCode || "----";
    }
    document.getElementById("scenario").innerText = currentGameState.scenario;

    await updatePlayerCount();
    setPhaseUI(data.phase);

    if (data.phase !== "waiting") {
      document.body.classList.add("game-started");
    } else {
      document.body.classList.remove("game-started");
    }

    if (data.phase === "answering" && data.round_ends_at) {
      const timerEl = document.getElementById("host-timer");
      if (timerEl) timerEl.style.display = "flex";
      startHostCountdown(data.round_ends_at);
    } else {
      const timerEl = document.getElementById("host-timer");
      if (timerEl) timerEl.style.display = "none";
    }

    if (data.phase === "results") {
      await loadWinnerForRound(data.round_number);
    } else if (data.phase === "leaderboard") {
      await renderLeaderboard();
    }
  } catch (err) {
    console.error("Unexpected loadGame error:", err);
  } finally {
    isBooting = false;
    showHostLoading(false);
  }
}

async function updatePlayerCount() {
  try {
    const { data, error } = await client.from("players").select("*");

    if (error) {
      console.error("Player count error:", error);
      return;
    }

    livePlayerCount = data?.length || 0;
    document.getElementById("player-count").innerText =
      `${livePlayerCount} players joined`;

    // ✅ NEW: render player list
    renderPlayerList(data || []);
  } catch (err) {
    console.error("Unexpected player count error:", err);
  }
}

client
  .channel("players-channel")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "players" },
    async (payload) => {
      await updatePlayerCount();
    },
  )
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "players" },
    async (payload) => {
      await updatePlayerCount();
    },
  )
  .on(
    "postgres_changes",
    { event: "DELETE", schema: "public", table: "players" },
    async (payload) => {
      await updatePlayerCount();
    },
  )
  .subscribe();

client
  .channel("game_state_updates")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "game_state" },
    async (payload) => {
      const phase = payload.new.phase;

      // change logo state
      if (phase !== "waiting") {
        document.body.classList.add("game-started");
      } else {
        document.body.classList.remove("game-started");
      }

      if (phase === "answering") {
        startHostCountdown(payload.new.round_ends_at);
      } else {
        if (hostCountdownInterval) clearInterval(hostCountdownInterval);
        const timerEl = document.getElementById("host-timer");
        if (timerEl) {
          timerEl.style.display = "none";
          timerEl.innerText = "";
        }
      }

      currentGameState = {
        round_number: payload.new.round_number,
        phase: payload.new.phase,
        scenario: payload.new.scenario || "Waiting for round to start...",
      };

      document.getElementById("scenario").innerText = currentGameState.scenario;

      if (phase === "waiting") {
        document.getElementById("answers").innerHTML = "";
        clearWinnerCard();
      }
      setPhaseUI(phase);

      if (phase === "results") {
        await loadWinnerForRound(payload.new.round_number);
      } else if (phase === "leaderboard") {
        await renderLeaderboard();
      }
    },
  )
  .subscribe();

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
        if (
          payload.new.round_number === currentGameState.round_number &&
          currentGameState.phase === "answering"
        ) {
          spawnAnswerBubble(payload.new.answer);
        }
      } catch (err) {
        console.error("Answer feed error:", err);
      }
    },
  )
  .subscribe();

const ROUND_DURATION = 60; // seconds

async function startGame() {
  if (isBusy) return;
  setBusy(true, { startLoading: true });
  try {
    if (!livePlayerCount || livePlayerCount === 0) {
      alert("❌ Cannot start game — no players have joined.");
      return;
    }

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
    const now = new Date();
    const endsAt = new Date(now.getTime() + ROUND_DURATION * 1000);

    const { error } = await client
      .from("game_state")
      .update({
        round_number: 1,
        phase: "answering",
        scenario: scenarioData.scenario,
        round_ends_at: endsAt.toISOString(),
      })
      .eq("id", 1);

    if (error) {
      console.error("Start game error:", error);
      alert("Failed to start game: " + error.message);
      return;
    }

    document.getElementById("answers").innerHTML = "";
    nextLane = 0;
    clearWinnerCard();
  } catch (err) {
    console.error("Unexpected startGame error:", err);
  } finally {
    setBusy(false);
  }
}

async function nextRound() {
  if (isBusy) return;
  setBusy(true, { nextRoundLoading: true });

  try {
    clearWinnerCard();
    document.getElementById("winner-card").style.display = "none";
    document.getElementById("leaderboard-card").style.display = "none";
    document.getElementById("answers").innerHTML = "";
    nextLane = 0;

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
      await showWinners();
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

    currentGameState = {
      round_number: nextRoundNumber,
      phase: "answering",
      scenario: scenarioData.scenario,
    };

    document.getElementById("scenario").innerText = scenarioData.scenario;
    setPhaseUI("answering");

    const now = new Date();
    const endsAt = new Date(now.getTime() + ROUND_DURATION * 1000);
    const { error: updateError } = await client
      .from("game_state")
      .update({
        round_number: nextRoundNumber,
        phase: "answering",
        scenario: scenarioData.scenario,
        round_ends_at: endsAt.toISOString(),
      })
      .eq("id", 1);

    if (updateError) {
      console.error("Next round update error:", updateError);
      alert("Failed to start next round: " + updateError.message);
      return;
    }
  } catch (err) {
    console.error("Unexpected nextRound error:", err);
  } finally {
    setBusy(false);
  }
}

async function resetGame() {
  if (isBusy) return;
  setBusy(true, { resetLoading: true });

  try {
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

    const { error: stateError } = await client
      .from("game_state")
      .update({
        phase: "waiting",
        round_number: 1,
        scenario: "Waiting for round to start...",
        round_ends_at: null,
      })
      .eq("id", 1);

    if (stateError) {
      console.error("Reset game_state error:", stateError);
      alert("Failed to reset game state: " + stateError.message);
      return;
    }

    livePlayerCount = 0;
    document.getElementById("answers").innerHTML = "";
    const playerList = document.getElementById("player-list");
    if (playerList) playerList.innerHTML = ""; // ✅ CLEAR UI

    nextLane = 0;
    clearWinnerCard();
    document.getElementById("leaderboard-list").innerHTML = "";
    await loadGame();
  } catch (err) {
    console.error("Unexpected resetGame error:", err);
  } finally {
    setBusy(false);
  }
}

function spawnAnswerBubble(text) {
  const answersBox = document.getElementById("answers");
  if (!answersBox) return;

  if (answersBox.children.length > 40) {
    answersBox.removeChild(answersBox.firstChild);
  }

  const laneIndex = nextLane;
  nextLane = (nextLane + 1) % 3;

  const bubble = document.createElement("div");
  bubble.className = "answer-item";
  bubble.innerText = text;
  bubble.style.animation = "none";
  bubble.style.visibility = "hidden";
  bubble.style.left = "0px";
  bubble.style.top = "0px";
  answersBox.appendChild(bubble);

  const boxWidth = answersBox.clientWidth;
  const boxHeight = answersBox.clientHeight;
  const laneWidth = Math.floor(boxWidth / 3);

  // constrain bubble to lane width if needed, otherwise CSS max-width handles it, make sure there is a gap of 24px
  bubble.style.maxWidth = `${laneWidth - 24}px`;

  const bubbleHeight = bubble.offsetHeight;
  const laneLeft = laneIndex * laneWidth;
  const startTop = boxHeight - bubbleHeight - 24;
  const rise = startTop - 24;

  bubble.style.left = `${laneLeft}px`;
  bubble.style.top = `${startTop}px`;
  bubble.style.setProperty("--rise", `${rise}px`);
  bubble.style.visibility = "visible";
  bubble.offsetHeight;
  bubble.style.animation = "floatBubble 3.8s linear forwards";

  setTimeout(() => {
    if (bubble.parentNode) bubble.remove();
  }, 4200);
}

async function getWinnerAvatar(playerName, tableCode) {
  try {
    const { data, error } = await client
      .from("players")
      .select("avatar")
      .eq("name", playerName)
      .eq("table_code", tableCode)
      .maybeSingle();

    if (error) {
      console.error("Failed to load winner avatar:", error);
      return null;
    }

    return data?.avatar || null;
  } catch (err) {
    console.error("Unexpected getWinnerAvatar error:", err);
    return null;
  }
}

async function renderLeaderboard() {
  if (currentGameState.phase !== "leaderboard") return;
  const list = document.getElementById("leaderboard-list");

  try {
    const { data, error } = await client
      .from("winners")
      .select("*")
      .order("round_number", { ascending: true });

    if (error) {
      console.error("Leaderboard error:", error);
      alert("Failed to load winners.");
      return;
    }

    list.innerHTML = "";

    if (!data || data.length === 0) {
      list.innerHTML = `<p class="leaderboard-empty">No winners yet.</p>`;
      return;
    }

    for (const [index, winner] of data.entries()) {
      const card = document.createElement("div");
      card.className = "leaderboard-item";

      if (index === 4) {
        card.classList.add("leaderboard-item-last");
      }

      const avatar = await getWinnerAvatar(
        winner.player_name,
        winner.table_code,
      );

      card.innerHTML = `
    <div class="leaderboard-top">
      <div class="leaderboard-round">Round ${winner.round_number}</div>
      <div class="leaderboard-table">Table ${winner.table_code}</div>
    </div>

    <div class="leaderboard-winner-row">
      ${avatar ? `<img src="${avatar}" class="leaderboard-avatar" alt="${winner.player_name}" />` : ""}
      <div class="leaderboard-name">${winner.player_name}</div>
    </div>

    <div class="leaderboard-answer">“${winner.answer || ""}”</div>
  `;

      list.appendChild(card);
    }
  } catch (err) {
    console.error("Unexpected leaderboard render error:", err);
  }
}

async function showWinners() {
  if (isBusy) return;
  setBusy(true, { leaderboardLoading: true });

  try {
    currentGameState.phase = "leaderboard";
    setPhaseUI("leaderboard");

    const { error } = await client
      .from("game_state")
      .update({ phase: "leaderboard" })
      .eq("id", 1);

    if (error) {
      console.error("Show winners state update error:", error);
      alert("Failed to open winners screen.");
      return;
    }
  } catch (err) {
    console.error("Unexpected leaderboard error:", err);
  } finally {
    setBusy(false);
  }
}

async function loadWinnerForRound(round) {
  try {
    const { data, error } = await client
      .from("winners")
      .select("*")
      .eq("round_number", round)
      .maybeSingle();

    if (error) {
      console.error("Load winner error:", error);
      showWinnerError("Unable to load the winning answer. Please try again.");
      return;
    }

    if (!data) {
      showNoWinnerCard();
      return;
    }

    const avatar = await getWinnerAvatar(data.player_name, data.table_code);

    hideWinnerLoading();
    document.getElementById("winner-card").style.display = "flex";
    document.getElementById("winner-title").innerText =
      "🏆 Best Marriage Advice";

    document.getElementById("winner-answer").innerHTML = `
  <span>“${data.answer}”</span>
`;

    document.getElementById("winner-player").innerHTML = `
  ${avatar ? `<img src="${avatar}" class="winner-avatar" alt="${data.player_name}" />` : ""}
  <span>${data.player_name} (Table ${data.table_code})</span>
`;

    document.getElementById("winner-reason").innerText =
      `🤖 AI Judge: ${data.reason || "No reason provided."}`;
  } catch (err) {
    console.error("Unexpected loadWinnerForRound error:", err);
    showWinnerError("Something went wrong while loading the winner.");
  }
}

async function evaluateAnswers() {
  if (isBusy) return;
  setBusy(true, { evaluateLoading: true });

  try {
    const { data: game, error: gameError } = await client
      .from("game_state")
      .select("round_number, scenario, phase")
      .eq("id", 1)
      .single();

    if (gameError || !game) {
      console.error("Failed to load game state:", gameError);
      showWinnerError("Failed to load game state.");
      return null;
    }

    const round = game.round_number;

    const { data: answerRows, error: answersError } = await client
      .from("answers")
      .select("name, answer, table_code")
      .eq("round_number", round)
      .order("id", { ascending: true });

    if (answersError) {
      console.error("Failed to load answers:", answersError);
      showWinnerError("Failed to load answers.");
      return null;
    }

    const allAnswers = (answerRows || [])
      .map((row) => ({
        name: row.name?.trim(),
        answer: row.answer?.trim(),
        table_code: row.table_code?.trim(),
      }))
      .filter((row) => row.name && row.answer && row.table_code)
      .filter((row) => row.answer !== "{}")
      .filter((row) => row.answer.length > 5);

    if (allAnswers.length === 0) {
      showWinnerError("No valid answers to judge.");
      currentGameState.phase = "results";
      setPhaseUI("results");
      return null;
    }

    let answersForAI = allAnswers;

    const { data: winnerRows, error: winnersError } = await client
      .from("winners")
      .select("player_name, table_code");

    if (!winnersError && Array.isArray(winnerRows)) {
      const previousWinnerKeys = new Set(
        winnerRows.map((row) => getPlayerKey(row.player_name, row.table_code)),
      );

      answersForAI = allAnswers.filter(
        (row) =>
          !previousWinnerKeys.has(getPlayerKey(row.name, row.table_code)),
      );
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
        showWinnerError(
          "No eligible winner found, and failed to update the game phase.",
        );
        return null;
      }

      showNoWinnerCard();
      return;
    }

    currentGameState.phase = "judging";
    setPhaseUI("judging");

    const { error: phaseError } = await client
      .from("game_state")
      .update({ phase: "judging" })
      .eq("id", 1);

    if (phaseError) {
      console.error("Failed to update phase:", phaseError);
      alert("Failed to enter judging phase.");
      return null;
    }

    showWinnerLoading("AI is choosing the funniest answer.");

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
      showWinnerError("Could not reach the AI judge. Please try again.");

      await client
        .from("game_state")
        .update({ phase: "answering" })
        .eq("id", 1);

      return null;
    }

    const winnerIndex = Number(result?.winner_index);

    if (!response.ok || !Number.isInteger(winnerIndex)) {
      console.error("AI response invalid:", result);
      showWinnerError("The AI response was invalid. Please try again.");

      await client
        .from("game_state")
        .update({ phase: "answering" })
        .eq("id", 1);

      return null;
    }

    const winner = answersForAI[winnerIndex];

    if (!winner) {
      console.error("Winner index invalid:", winnerIndex);
      showWinnerError("The AI picked an invalid winner. Please try again.");

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
        table_code: winner.table_code,
        answer: winner.answer,
        reason: result.reason || "No reason provided.",
      },
    ]);

    if (winnerSaveError) {
      console.error("Failed to save winner:", winnerSaveError);
      showWinnerError("Winner chosen, but failed to save to database.");

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
      showWinnerError("Winner chosen, but failed to update game phase.");

      await client
        .from("game_state")
        .update({ phase: "answering" })
        .eq("id", 1);

      return null;
    }

    await loadWinnerForRound(round);
    return;
  } catch (err) {
    console.error("Unexpected evaluateAnswers error:", err);
    showWinnerError("Something went wrong during judging. Please try again.");

    await client.from("game_state").update({ phase: "answering" }).eq("id", 1);

    return null;
  } finally {
    setBusy(false);
  }
}

loadGame();

function startBGM() {
  const bgm = document.getElementById("bgm");
  if (!bgm) return;

  bgm.volume = 0.4; // adjust
  bgm.play().catch(() => {
    // fallback: wait for user interaction
    document.addEventListener(
      "click",
      () => {
        bgm.play();
      },
      { once: true },
    );
  });
}

function startHostCountdown(endTimeString) {
  if (hostCountdownInterval) clearInterval(hostCountdownInterval);

  const endTime = new Date(endTimeString);

  hostCountdownInterval = setInterval(() => {
    const now = new Date();
    const diff = Math.floor((endTime - now) / 1000);

    const timerEl = document.getElementById("host-timer");
    if (!timerEl) return;

    if (diff <= 0) {
      timerEl.innerText = "⏰ Time's up!";
      clearInterval(hostCountdownInterval);
      return;
    }

    timerEl.innerText = `⏳ ${diff}s left`;
  }, 300);
}

function renderPlayerList(players) {
  const container = document.getElementById("player-list");
  if (!container) return;

  const maxPlayers = 12;

  // ✅ only keep newest players (Kahoot behavior)
  const latestPlayers = players.slice(-maxPlayers);

  // ✅ clear UI
  container.innerHTML = "";

  latestPlayers.reverse().forEach((p) => {
    const div = document.createElement("div");
    div.className = "player-card";
    const avatarSrc = p.avatar || "assets/avatars/Magikarp.png";

    div.innerHTML = `
      <img src="${avatarSrc}" class="player-avatar" />
      <div class="player-name">${p.name}</div>
    `;

    container.appendChild(div);
  });
}

async function getRoomCode() {
  const { data } = await client
    .from("game_state")
    .select("room_code")
    .eq("id", 1)
    .single();

  return data?.room_code;
}

function getRandomAvatar() {
  const avatars = [
    "assets/avatars/Naruto.png",
    "assets/avatars/Saitama.png",
    "assets/avatars/Hinata.png",
    "assets/avatars/Kakashi.png",
    "assets/avatars/Magikarp.png",
    "assets/avatars/Nami.png",
    "assets/avatars/Gaara.png",
    "assets/avatars/Squirtle.png",
    "assets/avatars/Luffy.png",
    "assets/avatars/Sasuke.png",
  ];

  return avatars[Math.floor(Math.random() * avatars.length)];
}

function logout() {
  localStorage.removeItem("adminKey");
  localStorage.removeItem("adminName");
  window.location.href = "login.html";
}
