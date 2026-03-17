const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtenRpcG1ocnd4ZGpub2d6bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDUxMzMsImV4cCI6MjA4ODUyMTEzM30.yLr4f8NLnLb7Vcf0kTgEMwQXTY8GbAPIZnLRdv3NzzU";

const client = supabase.createClient(supabaseUrl, supabaseKey);

let roomCode = "LOVE-2026";
let maxPlayers = 100;

// ======================
// AUTO REJOIN IF REFRESH
// ======================

window.onload = async function () {
  if (localStorage.getItem("joined") === "true") {
    showWaiting();

    const playerName = localStorage.getItem("playerName");
    const tableNo = localStorage.getItem("tableNo");

    if (playerName && tableNo) {
      document.getElementById("player-info").style.display = "block";

      document.getElementById("player-name-display").innerText =
        "👤 " + playerName;

      document.getElementById("player-table-display").innerText =
        " — Table " + tableNo;
    }

    const { data } = await client
      .from("game_state")
      .select("*")
      .limit(1)
      .single();

    if (data.phase === "answering") {
      showAnswerScreen();
    }
  }
};

// ===============================
// JOIN GAME
// ===============================
async function joinGame() {
  // check if game already started
  const { data: game } = await client
    .from("game_state")
    .select("phase")
    .eq("id", 1)
    .single();

  if (game.phase !== "waiting") {
    document.getElementById("join-error").innerText =
      "❌ The game has already started.";
    return;
  }

  // get values
  const playerName = document.getElementById("name").value;
  const tableNo = document.getElementById("table").value;
  const roomCode = document
    .getElementById("roomcode")
    .value.toUpperCase();

  if (!playerName || !tableNo || !roomCode) {
    alert("Please fill in your name, table number and room code");
    return;
  }

  const { error } = await client.from("players").insert([
    {
      name: playerName,
      table_no: tableNo,
      room_code: roomCode,
    },
  ]);

  if (error) {
    console.error(error);
    alert("Unable to join game");
    return;
  }

  localStorage.setItem("playerName", playerName);
  localStorage.setItem("tableNo", tableNo);
  localStorage.setItem("roomCode", roomCode);
  localStorage.setItem("joined", "true");

  document.getElementById("player-info").style.display = "block";

  document.getElementById("player-name-display").innerText =
    "👤 " + playerName;

  document.getElementById("player-table-display").innerText =
    " — Table " + tableNo;

  document.getElementById("join-screen").style.display = "none";

  showWaiting();
}

// ======================
// SHOW WAITING SCREEN
// ======================

function showWaiting() {
  document.getElementById("join-screen").style.display = "none";
  document.getElementById("waiting-screen").style.display = "block";
}

// ==================================
// LISTEN FOR ROUND START
// ==================================

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
      const phase = payload.new.phase;

      // reset game
      if (phase === "waiting") {
        localStorage.clear();
        location.reload();
        return;
      }

      // round starts
      if (
        localStorage.getItem("joined") === "true" &&
        phase === "answering"
      ) {
        localStorage.removeItem("submitted");
        showAnswerScreen();
      }
    }
  )
  .subscribe();

// ======================
// SHOW ANSWER SCREEN
// ======================

async function showAnswerScreen() {
  document.getElementById("join-screen").style.display = "none";
  document.getElementById("waiting-screen").style.display = "none";
  document.getElementById("submitted-screen").style.display = "none";

  document.getElementById("answer").value = "";

  if (localStorage.getItem("submitted") === "true") {
    document.getElementById("answer-screen").style.display = "none";
    document.getElementById("submitted-screen").style.display = "block";
    return;
  }

  document.getElementById("answer-screen").style.display = "block";

  const { data } = await client
    .from("game_state")
    .select("*")
    .limit(1)
    .single();

  document.getElementById("scenario").innerText = data.scenario;
}

// ======================
// SUBMIT ADVICE
// ======================

async function submitAdvice() {
  const answer = document.getElementById("answer").value.trim();
  const playerName = localStorage.getItem("playerName");

  if (!answer) {
    alert("Please enter your advice");
    return;
  }

  if (containsBannedWords(answer)) {
    alert("Please keep your advice respectful");
    return;
  }

  const { data: game } = await client
    .from("game_state")
    .select("round_number")
    .eq("id", 1)
    .single();

  const round = game.round_number;

  const { error } = await client.from("answers").insert([
    {
      name: playerName,
      answer: answer,
      round_number: round,
    },
  ]);

  if (error) {
    console.error(error);
    alert("You already submitted this round!");
    return;
  }

  localStorage.setItem("submitted", "true");

  document.getElementById("answer-screen").style.display = "none";
  document.getElementById("submitted-screen").style.display = "block";
}

// ======================
// RESET (TESTING)
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
