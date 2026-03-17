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

<<<<<<< HEAD
// ======================
// JOIN GAME
// ======================

=======
>>>>>>> c4a2df5 (initial clean commit)
// ===============================
// JOIN GAME
// ===============================
async function joinGame() {
<<<<<<< HEAD
  // get values from input fields
  const playerName = document.getElementById("name").value;
  const tableNo = document.getElementById("table").value;
  const roomCode = document.getElementById("roomcode").value;
=======

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

  // get values from input fields
  const playerName = document.getElementById("name").value;
  const tableNo = document.getElementById("table").value;
  const roomCode = document.getElementById("roomcode").value.toUpperCase();
>>>>>>> c4a2df5 (initial clean commit)

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

<<<<<<< HEAD
  document.getElementById("player-name-display").innerText = "👤 " + playerName;
=======
  document.getElementById("player-name-display").innerText =
    "👤 " + playerName;
>>>>>>> c4a2df5 (initial clean commit)

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

<<<<<<< HEAD
// ======================
// LISTEN FOR ROUND START
// ======================
=======
// ==================================
// LISTEN FOR ROUND START - Listener
// ==================================
>>>>>>> c4a2df5 (initial clean commit)

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
<<<<<<< HEAD
      if (
        localStorage.getItem("joined") === "true" &&
        payload.new.phase === "answering"
      ) {
        showAnswerScreen();
      }
=======

      const phase = payload.new.phase;

      // 🔁 detect reset from host
      if (phase === "waiting") {
        localStorage.clear();
        location.reload();
        return;
      }

      // ▶ round started
      if (
        localStorage.getItem("joined") === "true" &&
        phase === "answering"
      ) {
        localStorage.removeItem("submitted");
        showAnswerScreen();
      }

>>>>>>> c4a2df5 (initial clean commit)
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
<<<<<<< HEAD

  // check if player already submitted
  if (localStorage.getItem("submitted") === "true") {
=======
  document.getElementById("submitted-screen").style.display = "none";

  // clear previous answer input
  document.getElementById("answer").value = "";

  // check if player already submitted
  if (localStorage.getItem("submitted") === "true") {
    document.getElementById("answer-screen").style.display = "none";
>>>>>>> c4a2df5 (initial clean commit)
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

<<<<<<< HEAD
  // clear input
  document.getElementById("answer").value = "";
=======
  // ✅ mark submission locally
  localStorage.setItem("submitted", "true");

  // hide answer screen
  document.getElementById("answer-screen").style.display = "none";

  // show submitted screen
  document.getElementById("submitted-screen").style.display = "block";
>>>>>>> c4a2df5 (initial clean commit)
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
