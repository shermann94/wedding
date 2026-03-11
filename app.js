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
    // check if round already started
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

// ======================
// JOIN GAME
// ======================

// ===============================
// JOIN GAME
// ===============================
async function joinGame() {
  // get values from input fields
  const playerName = document.getElementById("name").value;
  const tableNo = document.getElementById("table").value;
  const roomCode = document.getElementById("roomcode").value;

  // basic validation
  if (!playerName || !tableNo || !roomCode) {
    alert("Please fill in your name, table number and room code");
    return;
  }

  // insert player into database
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

  // save player info locally
  localStorage.setItem("playerName", playerName);
  localStorage.setItem("tableNo", tableNo);
  localStorage.setItem("roomCode", roomCode);
  localStorage.setItem("joined", "true");

  // show player identity container
  document.getElementById("player-info").style.display = "block";

  document.getElementById("player-name-display").innerText = "👤 " + playerName;

  document.getElementById("player-table-display").innerText =
    " — Table " + tableNo;

  // hide join section
  document.getElementById("join-screen").style.display = "none";

  // show waiting screen
  showWaiting();
}

// ======================
// SHOW WAITING SCREEN
// ======================

function showWaiting() {
  document.getElementById("join-screen").style.display = "none";
  document.getElementById("waiting-screen").style.display = "block";
}

// ======================
// LISTEN FOR ROUND START
// ======================

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
      if (
        localStorage.getItem("joined") === "true" &&
        payload.new.phase === "answering"
      ) {
        showAnswerScreen();
      }
    },
  )
  .subscribe();

// ======================
// SHOW ANSWER SCREEN
// ======================

async function showAnswerScreen() {
  // hide other screens
  document.getElementById("join-screen").style.display = "none";
  document.getElementById("waiting-screen").style.display = "none";

  // check if player already submitted
  if (localStorage.getItem("submitted") === "true") {
    document.getElementById("submitted-screen").style.display = "block";

    return;
  }

  // show answer screen
  document.getElementById("answer-screen").style.display = "block";

  // load scenario
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
  // get player input
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

  // get current round
  const { data: game } = await client
    .from("game_state")
    .select("round_number")
    .eq("id", 1)
    .single();

  const round = game.round_number;

  // insert answer
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

  // clear input
  document.getElementById("answer").value = "";
}

// ======================
// RESET PLAYER STATE (FOR TESTING)
// ======================

function resetGame() {
  localStorage.clear();
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
