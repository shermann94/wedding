const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU";
const client = supabase.createClient(supabaseUrl, supabaseKey);

let isSubmitting = false;
let isBooting = true;
let isBusy = false;

function showPlayerLoading(show) {
  const loading = document.getElementById("player-loading-screen");
  if (!loading) return;
  loading.style.display = show ? "flex" : "none";
}

function hideAllPlayerScreens() {
  document.getElementById("join-screen").style.display = "none";
  document.getElementById("waiting-screen").style.display = "none";
  document.getElementById("answer-screen").style.display = "none";
  document.getElementById("submitted-screen").style.display = "none";
}

function setPlayerBusy(value, options = {}) {
  isBusy = value;

  const joinBtn = document.getElementById("join-btn");
  const submitBtn = document.getElementById("submit-btn");

  if (joinBtn) {
    joinBtn.disabled = value;
    joinBtn.innerText =
      value && options.joinLoading ? "Joining..." : "Join Game";
  }

  if (submitBtn) {
    submitBtn.disabled = value;
    submitBtn.innerText =
      value && options.submitLoading ? "Submitting..." : "Submit Advice";
  }
}

function clearGameLocalState() {
  localStorage.removeItem("playerName");
  localStorage.removeItem("tableNo");
  localStorage.removeItem("roomCode");
  localStorage.removeItem("joined");
  localStorage.removeItem("submittedRound");
}

function setSubmitButtonLoading(isLoading) {
  const btn = document.getElementById("submit-btn");
  if (!btn) return;

  btn.disabled = isLoading;
  btn.innerText = isLoading ? "Submitting..." : "Submit Advice";
}

function getSubmittedRound() {
  return Number(localStorage.getItem("submittedRound") || 0);
}

function setSubmittedRound(round) {
  localStorage.setItem("submittedRound", String(round));
}

function updatePlayerInfoUI() {
  const playerName = localStorage.getItem("playerName");
  const tableNo = localStorage.getItem("tableNo");

  if (playerName && tableNo) {
    document.getElementById("player-info").style.display = "block";
    document.getElementById("player-name-display").innerText =
      "👤 " + playerName;
    document.getElementById("player-table-display").innerText =
      " — Table " + tableNo;
  }
}

async function hasSubmittedForRound(round) {
  const playerName = localStorage.getItem("playerName");
  const storedTableNo = localStorage.getItem("tableNo");
  const tableNo = Number(storedTableNo);

  if (!playerName || !Number.isInteger(tableNo) || tableNo < 1) {
    return false;
  }

  try {
    const { data, error } = await client
      .from("answers")
      .select("id")
      .eq("name", playerName)
      .eq("table_no", tableNo)
      .eq("round_number", round)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to check submission state:", error);
      return getSubmittedRound() === round;
    }

    return Boolean(data);
  } catch (err) {
    console.error("Unexpected submission check error:", err);
    return getSubmittedRound() === round;
  }
}

window.onload = async function () {
  try {
    isBooting = true;
    hideAllPlayerScreens();
    showPlayerLoading(true);

    if (localStorage.getItem("joined") !== "true") {
      document.getElementById("join-screen").style.display = "block";
      return;
    }

    updatePlayerInfoUI();

    const { data, error } = await client
      .from("game_state")
      .select("*")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.error("Failed to load game state on refresh:", error);
      showWaiting();
      return;
    }

    if (data.phase === "waiting") {
      showWaiting();
      return;
    }

    if (data.phase === "answering") {
      const alreadySubmitted = await hasSubmittedForRound(data.round_number);

      if (alreadySubmitted) {
        setSubmittedRound(data.round_number);
        showSubmittedScreen();
      } else {
        localStorage.removeItem("submittedRound");
        await showAnswerScreen(data.scenario);
      }

      return;
    }

    showSubmittedScreen();
  } catch (err) {
    console.error("Window load error:", err);
  } finally {
    isBooting = false;
    showPlayerLoading(false);
  }
};

async function joinGame() {
  if (isBusy) return;
  setPlayerBusy(true, { joinLoading: true });
  document.getElementById("join-error").innerText = "";

  try {
    const { data: game, error: gameError } = await client
      .from("game_state")
      .select("phase, room_code")
      .eq("id", 1)
      .single();

    if (gameError || !game) {
      console.error("Failed to load game state:", gameError);
      alert("Failed to load game settings.");
      return;
    }

    if (game.phase !== "waiting") {
      document.getElementById("join-error").innerText =
        "❌ The game has already started.";
      return;
    }

    const playerName = document.getElementById("name").value.trim();
    const tableNo = document.getElementById("table").value.trim();
    const enteredRoomCode = document
      .getElementById("roomcode")
      .value.trim()
      .toUpperCase();

    if (!playerName || !tableNo || !enteredRoomCode) {
      alert("Please fill in your name, table number and room code.");
      return;
    }

    const rawRoomCode = game.room_code.toUpperCase();
    const formattedRoomCode =
      rawRoomCode.slice(0, 4) + "-" + rawRoomCode.slice(4);

    if (
      enteredRoomCode !== rawRoomCode &&
      enteredRoomCode !== formattedRoomCode
    ) {
      document.getElementById("join-error").innerText = "❌ Wrong room code.";
      return;
    }

    const tableNumber = Number(tableNo);

    if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 23) {
      alert("Please enter a valid table number.");
      return;
    }

    const { data: existingPlayer, error: existingError } = await client
      .from("players")
      .select("id")
      .eq("name", playerName)
      .eq("table_no", tableNumber)
      .eq("room_code", rawRoomCode)
      .maybeSingle();

    if (existingError) {
      console.error("Existing player lookup error:", existingError);
    }

    if (!existingPlayer) {
      const { error } = await client.from("players").insert([
        {
          name: playerName,
          table_no: tableNumber,
          room_code: rawRoomCode,
        },
      ]);

      if (error) {
        console.error("Join error:", error);
        alert("Unable to join game: " + error.message);
        return;
      }
    }

    localStorage.setItem("playerName", playerName);
    localStorage.setItem("tableNo", String(tableNumber));
    localStorage.setItem("roomCode", rawRoomCode);
    localStorage.setItem("joined", "true");
    localStorage.removeItem("submittedRound");

    updatePlayerInfoUI();
    showWaiting();
  } catch (err) {
    console.error("Unexpected join error:", err);
    alert("Something went wrong while joining.");
  } finally {
    setPlayerBusy(false);
  }
}

function showWaiting() {
  hideAllPlayerScreens();
  document.getElementById("waiting-screen").style.display = "block";
}

function showSubmittedScreen() {
  hideAllPlayerScreens();
  document.getElementById("submitted-screen").style.display = "block";
}

client
  .channel("player_game_state_updates")
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "game_state",
    },
    async (payload) => {
      const phase = payload.new.phase;
      const round = payload.new.round_number;

      if (phase === "waiting") {
        clearGameLocalState();
        location.reload();
        return;
      }

      if (localStorage.getItem("joined") !== "true") {
        return;
      }

      if (phase === "answering") {
        const alreadySubmitted = await hasSubmittedForRound(round);

        if (alreadySubmitted) {
          setSubmittedRound(round);
          showSubmittedScreen();
        } else {
          localStorage.removeItem("submittedRound");
          await showAnswerScreen(payload.new.scenario);
        }
      } else if (
        phase === "judging" ||
        phase === "results" ||
        phase === "leaderboard"
      ) {
        showSubmittedScreen();
      }
    },
  )
  .subscribe();

async function showAnswerScreen(prefetchedScenario) {
  hideAllPlayerScreens();
  document.getElementById("answer-screen").style.display = "block";
  document.getElementById("answer").value = "";

  updatePlayerInfoUI();
  setSubmitButtonLoading(false);

  if (prefetchedScenario) {
    document.getElementById("scenario").innerText = prefetchedScenario;
    return;
  }

  try {
    const { data, error } = await client
      .from("game_state")
      .select("scenario")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.error("Failed to load scenario:", error);
      document.getElementById("scenario").innerText =
        "Failed to load scenario.";
      return;
    }

    document.getElementById("scenario").innerText = data.scenario;
  } catch (err) {
    console.error("Show answer screen error:", err);
  }
}

async function submitAdvice() {
  if (isSubmitting || isBusy) return;

  try {
    const answer = document.getElementById("answer").value.trim();
    const playerName = localStorage.getItem("playerName");
    const storedTableNo = localStorage.getItem("tableNo");
    const tableNo = Number(storedTableNo);

    if (!answer) {
      alert("Please enter your advice.");
      return;
    }

    if (!playerName || !storedTableNo) {
      alert("Player info missing. Please rejoin the game.");
      return;
    }

    if (!Number.isInteger(tableNo) || tableNo < 1) {
      alert("Table number missing. Please rejoin the game.");
      return;
    }

    if (containsBannedWords(answer)) {
      alert("Please keep your advice respectful.");
      return;
    }

    isSubmitting = true;
    setPlayerBusy(true, { submitLoading: true });

    const { data: game, error: gameError } = await client
      .from("game_state")
      .select("round_number, phase")
      .eq("id", 1)
      .single();

    if (gameError || !game) {
      console.error("Failed to load game before submit:", gameError);
      alert("Failed to load game state.");
      return;
    }

    if (game.phase !== "answering") {
      alert("This round is no longer accepting answers.");
      return;
    }

    const round = game.round_number;
    const alreadySubmitted = await hasSubmittedForRound(round);

    if (alreadySubmitted) {
      setSubmittedRound(round);
      showSubmittedScreen();
      return;
    }

    const { error } = await client.from("answers").insert([
      {
        name: playerName,
        table_no: tableNo,
        answer: answer,
        round_number: round,
      },
    ]);

    if (error) {
      console.error("Submit error:", error);
      alert("Submit failed: " + error.message);
      return;
    }

    setSubmittedRound(round);
    showSubmittedScreen();
  } catch (err) {
    console.error("Unexpected submit error:", err);
    alert("Something went wrong while submitting.");
  } finally {
    isSubmitting = false;
    setPlayerBusy(false);
  }
}

function resetGame() {
  clearGameLocalState();
  location.reload();
}

function containsBannedWords(answer) {
  const bannedWords = [
    "fuck",
    "bitch",
    "cb",
    "knn",
    "fark",
    "pussy",
    "stupid",
    "dumb",
    "idiot",
    "asshole",
    "shit",
    "bastard",
    "dick",
    "cunt",
    "slut",
    "whore",
    "nigger",
    "nigga",
    "faggot",
  ];

  const text = answer.toLowerCase();
  return bannedWords.some((banned) => text.includes(banned));
}
