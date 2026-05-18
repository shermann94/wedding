const supabaseUrl = "https://dmztipmhrwxdjnogznvi.supabase.co";
const supabaseKey = "sb_publishable_GprPBK44VLeb-3P7_qgOKA_WBpVkOSq";
const client = supabase.createClient(supabaseUrl, supabaseKey);

let isSubmitting = false;
let isBooting = true;
let isBusy = false;
let countdownInterval = null;
let selectedAvatar = null;

async function refreshAvatarFromDB() {
  const token = localStorage.getItem("playerToken");
  if (!token) return;

  const { data: player } = await client
    .from("players")
    .select("avatar")
    .eq("player_token", token)
    .maybeSingle();

  if (player?.avatar) {
    localStorage.setItem("avatar", player.avatar);
    updatePlayerInfoUI();
  }
}

function selectAvatar(img) {
  // remove previous selection
  document
    .querySelectorAll("#avatar-list img")
    .forEach((el) => el.classList.remove("selected"));

  // highlight selected
  img.classList.add("selected");

  // store selected avatar
  selectedAvatar = img.getAttribute("src");
}

async function confirmAvatar() {
  if (!selectedAvatar) {
    alert("Please select an avatar!");
    return;
  }

  const playerId = localStorage.getItem("playerId");

  const { error } = await client
    .from("players")
    .update({ avatar: selectedAvatar })
    .eq("id", playerId)
    .select();

  if (error) {
    console.error("Avatar save error:", error);
    alert("Failed to save avatar");
    return;
  }

  // save locally
  localStorage.setItem("avatar", selectedAvatar);
  localStorage.setItem("avatarConfirmed", "true");

  // go to next screen
  showWaiting();
}

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
  document.getElementById("avatar-screen").style.display = "none";
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
  localStorage.removeItem("tableCode");
  localStorage.removeItem("roomCode");
  localStorage.removeItem("joined");
  localStorage.removeItem("submittedRound");
  localStorage.removeItem("avatar");
  localStorage.removeItem("playerId");
  localStorage.removeItem("playerToken");
  localStorage.removeItem("avatarConfirmed");
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

async function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  const { data, error } = await client
    .from("game_state")
    .select("round_ends_at")
    .eq("id", 1)
    .single();

  if (error || !data?.round_ends_at) return;

  const endTime = new Date(data.round_ends_at);

  countdownInterval = setInterval(() => {
    const now = new Date();
    const diff = Math.floor((endTime - now) / 1000);

    const timerEl = document.getElementById("timer");

    if (!timerEl) return;

    if (diff <= 0) {
      timerEl.innerText = "⏰ Time's up!";
      clearInterval(countdownInterval);

      document.getElementById("submit-btn").disabled = true;
      const inputEl = document.getElementById("answer");
      if (inputEl) inputEl.style.display = "none";

      // ✅ SHOW MESSAGE
      const msg = document.getElementById("time-up-msg");
      if (msg) msg.style.display = "block";

      return;
    }

    timerEl.innerText = `⏳ ${Math.max(diff, 0)}s remaining`;
  }, 500);
}

function sanitizeTableCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

function setFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(`${inputId}-error`);

  if (input) input.classList.add("input-error");
  if (errorEl) {
    errorEl.innerText = message;
    errorEl.classList.add("show");
  }
}

function clearFieldError(inputId) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(`${inputId}-error`);

  if (input) input.classList.remove("input-error");
  if (errorEl) {
    errorEl.innerText = "";
    errorEl.classList.remove("show");
  }
}

async function getCanonicalTableCode(inputCode) {
  const sanitizedInput = sanitizeTableCode(inputCode);
  if (!sanitizedInput) return null;

  const { data, error } = await client.from("tables").select("table_code");

  if (error) {
    console.error("Failed to load tables:", error);
    throw new Error("Failed to validate table code.");
  }

  const match = (data || []).find(
    (row) => sanitizeTableCode(row.table_code) === sanitizedInput,
  );

  return match ? match.table_code : null;
}

function updatePlayerInfoUI() {
  const playerName = localStorage.getItem("playerName");
  const tableCode = localStorage.getItem("tableCode");
  const avatar = localStorage.getItem("avatar");
  const avatarEl = document.getElementById("player-avatar");

  if (avatar && avatarEl) {
    avatarEl.src = avatar;
  }

  if (playerName && tableCode) {
    document.getElementById("player-info").style.display = "block";
    document.getElementById("player-name-display").innerText = playerName;
    document.getElementById("player-table-display").innerText =
      " — Table " + tableCode;
  }
}

async function hasSubmittedForRound(round) {
  const playerName = localStorage.getItem("playerName");
  const tableCode = localStorage.getItem("tableCode");

  if (!playerName || !tableCode) {
    return false;
  }

  try {
    const { data, error } = await client
      .from("answers")
      .select("id")
      .eq("name", playerName)
      .eq("table_code", tableCode)
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
  document.getElementById("table")?.addEventListener("input", () => {
    clearFieldError("table");
  });

  document.getElementById("roomcode")?.addEventListener("input", () => {
    clearFieldError("roomcode");
  });
  try {
    isBooting = true;
    hideAllPlayerScreens();
    showPlayerLoading(true);

    const token = localStorage.getItem("playerToken");

    if (token) {
      const { data: player } = await client
        .from("players")
        .select("*")
        .eq("player_token", token)
        .maybeSingle();

      if (player) {
        localStorage.setItem("playerName", player.name);
        localStorage.setItem("tableCode", player.table_code);
        localStorage.setItem("roomCode", player.room_code);
        localStorage.setItem("joined", "true");
        localStorage.setItem("playerId", player.id);

        if (player?.avatar && player.avatar !== "null") {
          localStorage.setItem("avatar", player.avatar);
          localStorage.setItem("avatarConfirmed", "true");
        } else {
          localStorage.removeItem("avatar");
          localStorage.removeItem("avatarConfirmed");
        }
      } else {
        clearGameLocalState();
      }
    }

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
      localStorage.removeItem("submittedRound");
      return;
    }

    // ✅ check if avatar exists
    const avatarConfirmed = localStorage.getItem("avatarConfirmed");

    if (avatarConfirmed !== "true" && data.phase === "waiting") {
      hideAllPlayerScreens();
      document.getElementById("avatar-screen").style.display = "block";
      return;
    }

    if (data.phase === "waiting") {
      showWaiting();
      return;
    }

    if (data.phase === "answering") {
      await refreshAvatarFromDB(); // ✅ ADD THIS

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
  clearFieldError("table");
  clearFieldError("roomcode");

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

    const playerName = document.getElementById("name").value.trim();
    const rawTableInput = document.getElementById("table").value;
    const enteredRoomCode = document
      .getElementById("roomcode")
      .value.trim()
      .toUpperCase();

    // Player Token Logic
    let playerToken = localStorage.getItem("playerToken");

    if (!playerToken) {
      playerToken = crypto.randomUUID();
      localStorage.setItem("playerToken", playerToken);
    }

    if (!playerName || !rawTableInput || !enteredRoomCode) {
      alert("Please fill in your name, table number and game code.");
      return;
    }

    const rawRoomCode = game.room_code.toUpperCase();
    const formattedRoomCode =
      rawRoomCode.length >= 8
        ? rawRoomCode.slice(0, 4) + "-" + rawRoomCode.slice(4)
        : rawRoomCode;

    const isRoomCodeWrong =
      enteredRoomCode !== rawRoomCode && enteredRoomCode !== formattedRoomCode;

    let canonicalTableCode;
    try {
      canonicalTableCode = await getCanonicalTableCode(rawTableInput);
    } catch (err) {
      alert(err.message);
      return;
    }

    const isTableWrong = !canonicalTableCode;

    if (isTableWrong)
      setFieldError(
        "table",
        "❌ Table number not found. Please check your table number.",
      );
    if (isRoomCodeWrong) setFieldError("roomcode", "❌ Wrong game code.");
    if (isTableWrong || isRoomCodeWrong) return;

    /* Old identification
    const { data: existingPlayer, error: existingError } = await client
      .from("players")
      .select("id")
      .eq("name", playerName)
      .eq("table_code", canonicalTableCode)
      .eq("room_code", rawRoomCode)
      .maybeSingle();
    */

    //Check existing player
    /*
    const { data: existingPlayer, error: existingError } = await client
      .from("players")
      .select("*")
      .eq("player_token", playerToken)
      .maybeSingle();
      */
    let existingPlayer = null;

    // 1. Try token first
    if (playerToken) {
      const { data } = await client
        .from("players")
        .select("*")
        .eq("player_token", playerToken)
        .maybeSingle();

      existingPlayer = data;
    }

    // 2. Fallback: name + table + room
    if (!existingPlayer) {
      const { data } = await client
        .from("players")
        .select("*")
        .eq("name", playerName)
        .eq("table_code", canonicalTableCode)
        .eq("room_code", rawRoomCode)
        .maybeSingle();

      existingPlayer = data;

      // ✅ restore token if found
      if (existingPlayer?.player_token) {
        localStorage.setItem("playerToken", existingPlayer.player_token);
      }
    }

    //Phase Check
    if (game.phase !== "waiting" && !existingPlayer) {
      alert("❌ The game has already started.");
      return;
    }

    /*
    if (existingError) {
      console.error("Existing player lookup error:", existingError);
    }
    */

    let playerId = null;

    if (!existingPlayer) {
      const { data, error } = await client
        .from("players")
        .insert([
          {
            name: playerName,
            table_code: canonicalTableCode,
            room_code: rawRoomCode,
            player_token: playerToken,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Join error:", error);
        alert("Unable to join game: " + error.message);
        return;
      }

      playerId = data.id;
    } else {
      playerId = existingPlayer.id;
    }

    // ✅ ADD THIS LINE
    localStorage.setItem("playerId", playerId);

    if (existingPlayer) {
      // returning player → use DB values
      localStorage.setItem("playerName", existingPlayer.name);
      localStorage.setItem("tableCode", existingPlayer.table_code);
      localStorage.setItem("roomCode", existingPlayer.room_code);
    } else {
      // new player → use input
      localStorage.setItem("playerName", playerName);
      localStorage.setItem("tableCode", canonicalTableCode);
      localStorage.setItem("roomCode", rawRoomCode);
    }

    localStorage.setItem("joined", "true");
    localStorage.removeItem("submittedRound");
    localStorage.removeItem("avatarConfirmed"); // ✅ ADD THIS

    document.getElementById("table").value = canonicalTableCode;

    updatePlayerInfoUI();

    const existingAvatar =
      (existingPlayer && existingPlayer.avatar) ||
      localStorage.getItem("avatar");

    if (existingAvatar && existingAvatar !== "null") {
      localStorage.setItem("avatar", existingAvatar);
      localStorage.setItem("avatarConfirmed", "true");
      showWaiting();
      return;
    }

    // ✅ show avatar selection screen
    hideAllPlayerScreens();
    document.getElementById("avatar-screen").style.display = "block";
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

      // ✅ ADD THIS
      if (phase !== "answering") {
        if (countdownInterval) clearInterval(countdownInterval);
      }

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
  // ✅ ADD THIS FIRST
  const token = localStorage.getItem("playerToken");

  if (token) {
    const { data: player } = await client
      .from("players")
      .select("avatar")
      .eq("player_token", token)
      .maybeSingle();

    if (player?.avatar) {
      localStorage.setItem("avatar", player.avatar);
    }
  }
  // ✅ SHOW input again for new round
  const inputEl = document.getElementById("answer");
  if (inputEl) inputEl.style.display = "block";

  // also re-enable submit button
  const submitBtn = document.getElementById("submit-btn");
  if (submitBtn) submitBtn.disabled = false;

  const msg = document.getElementById("time-up-msg");
  if (msg) msg.style.display = "none";

  hideAllPlayerScreens();
  document.getElementById("answer-screen").style.display = "block";
  document.getElementById("answer").value = "";

  updatePlayerInfoUI();
  setSubmitButtonLoading(false);

  // timer starts
  startCountdown();

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
    const tableCode = localStorage.getItem("tableCode");

    if (!answer) {
      alert("Please enter your advice.");
      return;
    }

    if (!playerName || !tableCode) {
      alert("Player info missing. Please rejoin the game.");
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
      .select("round_number, phase, round_ends_at")
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

    // ✅ ADD THIS BLOCK HERE
    const now = new Date();
    const endTime = new Date(game.round_ends_at);

    if (now > endTime) {
      showSubmittedScreen();
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
        table_code: tableCode,
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
    "fuk",
    "fuc",
    "shit",
    "bitch",
    "bish",
    "bastard",
    "asshole",
    "arsehole",
    "dick",
    "cock",
    "pussy",
    "pooseh",
    "poosy",
    "poosie",
    "cunt",
    "slut",
    "whore",
    "cb",
    "ccb",
    "knn",
    "knnb",
    "kanina",
    "kaninabe",
    "lanjiao",
    "lj",
    "stupid",
    "dumb",
    "idiot",
    "moron",
    "nigger",
    "nigga",
    "faggot",
  ];

  const text = String(answer || "")
    .toLowerCase()
    // 🔥 normalize first
    .replace(/@/g, "a")
    .replace(/!/g, "i")
    .replace(/\$/g, "s")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    // then clean
    .replace(/[^a-z0-9]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");

  return bannedWords.some((banned) => text.includes(banned));
}
