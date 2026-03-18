const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU";
const client = supabase.createClient(supabaseUrl, supabaseKey);

// ======================
// AUTO REJOIN IF REFRESH
// ======================

window.onload = async function () {
  try {
    if (localStorage.getItem("joined") === "true") {
      const playerName = localStorage.getItem("playerName");
      const tableNo = localStorage.getItem("tableNo");

      if (playerName && tableNo) {
        document.getElementById("player-info").style.display = "block";
        document.getElementById("player-name-display").innerText =
          "👤 " + playerName;
        document.getElementById("player-table-display").innerText =
          " — Table " + tableNo;
      }

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

      if (data.phase === "answering") {
        showAnswerScreen();
      } else if (data.phase === "waiting") {
        showWaiting();
      } else {
        showSubmittedScreen();
      }
    }
  } catch (err) {
    console.error("Window load error:", err);
  }
};

// ===============================
// JOIN GAME
// ===============================

async function joinGame() {
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

    localStorage.setItem("playerName", playerName);
    localStorage.setItem("tableNo", String(tableNumber));
    localStorage.setItem("roomCode", rawRoomCode);
    localStorage.setItem("joined", "true");
    localStorage.removeItem("submitted");

    document.getElementById("player-info").style.display = "block";
    document.getElementById("player-name-display").innerText =
      "👤 " + playerName;
    document.getElementById("player-table-display").innerText =
      " — Table " + tableNumber;

    showWaiting();
  } catch (err) {
    console.error("Unexpected join error:", err);
    alert("Something went wrong while joining.");
  }
}

// ======================
// SHOW SCREENS
// ======================

function showWaiting() {
  document.getElementById("join-screen").style.display = "none";
  document.getElementById("answer-screen").style.display = "none";
  document.getElementById("submitted-screen").style.display = "none";
  document.getElementById("waiting-screen").style.display = "block";
}

function showSubmittedScreen() {
  document.getElementById("join-screen").style.display = "none";
  document.getElementById("waiting-screen").style.display = "none";
  document.getElementById("answer-screen").style.display = "none";
  document.getElementById("submitted-screen").style.display = "block";
}

// ==================================
// LISTEN FOR GAME STATE CHANGES
// ==================================

client
  .channel("player_game_state_updates")
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "game_state",
    },
    (payload) => {
      const phase = payload.new.phase;

      if (phase === "waiting") {
        localStorage.clear();
        location.reload();
        return;
      }

      if (localStorage.getItem("joined") !== "true") {
        return;
      }

      if (phase === "answering") {
        localStorage.removeItem("submitted");
        showAnswerScreen();
      } else if (phase === "judging" || phase === "results") {
        showSubmittedScreen();
      }
    },
  )
  .subscribe();

// ======================
// SHOW ANSWER SCREEN
// ======================

async function showAnswerScreen() {
  document.getElementById("join-screen").style.display = "none";
  document.getElementById("waiting-screen").style.display = "none";
  document.getElementById("submitted-screen").style.display = "none";

  if (localStorage.getItem("submitted") === "true") {
    showSubmittedScreen();
    return;
  }

  document.getElementById("answer-screen").style.display = "block";
  document.getElementById("answer").value = "";

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

// ======================
// SUBMIT ADVICE
// ======================

async function submitAdvice() {
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

    localStorage.setItem("submitted", "true");
    showSubmittedScreen();
  } catch (err) {
    console.error("Unexpected submit error:", err);
    alert("Something went wrong while submitting.");
  }
}

// ======================
// RESET LOCAL (TESTING)
// ======================

function resetGame() {
  localStorage.clear();
  location.reload();
}

// ======================
// FILTER
// ======================

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
