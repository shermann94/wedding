import { answerPoolsByRound, fallbackAnswers } from "./answersPool.js";

if (location.hostname === "localhost") {
  const loadTestControl = {
    timerId: null,
    isRunning: false,
    playersSeeded: [],
  };

  const defaultTableCodes = [
    "VIP1",
    "VIP2",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "22",
    "23",
  ];

  function getWeightedRandomBucket() {
    const roll = Math.random();

    if (roll < 0.65) return "strong";
    if (roll < 0.9) return "medium";
    return "weak";
  }

  function randomAnswerForRound(round) {
    const poolSet = answerPoolsByRound[round];

    if (!poolSet) {
      return fallbackAnswers[
        Math.floor(Math.random() * fallbackAnswers.length)
      ];
    }

    const bucket = getWeightedRandomBucket();
    const bucketPool = poolSet[bucket];

    if (!Array.isArray(bucketPool) || bucketPool.length === 0) {
      return fallbackAnswers[
        Math.floor(Math.random() * fallbackAnswers.length)
      ];
    }

    return bucketPool[Math.floor(Math.random() * bucketPool.length)];
  }

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function getRoomCode() {
    const { data, error } = await client
      .from("game_state")
      .select("room_code")
      .eq("id", 1)
      .single();

    if (error || !data?.room_code) {
      throw new Error("Unable to load game code from game_state.");
    }

    return data.room_code;
  }

  async function getValidTableCodes() {
    const { data, error } = await client.from("tables").select("table_code");

    if (error) {
      console.warn("Failed to load tables, falling back to defaults:", error);
      return defaultTableCodes;
    }

    const codes = (data || [])
      .map((row) => String(row.table_code || "").trim())
      .filter(Boolean);

    return codes.length ? codes : defaultTableCodes;
  }

  function buildPlayers(total, roomCode, tableCodes) {
    return Array.from({ length: total }, (_, index) => ({
      name: `LoadTestUser${index + 1}`,
      table_code: tableCodes[index % tableCodes.length],
      room_code: roomCode,
    }));
  }

  async function getCurrentRoundState() {
    const { data, error } = await client
      .from("game_state")
      .select("round_number, phase")
      .eq("id", 1)
      .single();

    if (error || !data) {
      throw new Error("Unable to load current game state.");
    }

    return data;
  }

  async function clearOldLoadTestData(round) {
    const { error: answerDeleteError } = await client
      .from("answers")
      .delete()
      .eq("round_number", round)
      .like("name", "LoadTestUser%");

    if (answerDeleteError) {
      console.warn("Failed to clear old fake answers:", answerDeleteError);
    }

    const { error: playerDeleteError } = await client
      .from("players")
      .delete()
      .like("name", "LoadTestUser%");

    if (playerDeleteError) {
      console.warn("Failed to clear old fake players:", playerDeleteError);
    }

    loadTestControl.playersSeeded = [];
  }

  async function seedPlayers(total) {
    const roomCode = await getRoomCode();
    const tableCodes = await getValidTableCodes();
    const players = buildPlayers(total, roomCode, tableCodes);

    const batchSize = 50;

    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);

      const { error } = await client.from("players").insert(batch);

      if (error) {
        throw new Error(`Failed to insert fake players: ${error.message}`);
      }

      console.log(
        `Inserted players ${i + 1}-${Math.min(i + batchSize, players.length)}/${players.length}`,
      );
    }

    loadTestControl.playersSeeded = players;
    return players;
  }

  function getAdaptiveDelay(elapsedMs, remaining, totalDurationMs) {
    const remainingBudget = totalDurationMs - elapsedMs;

    if (remaining <= 0) return 0;

    const base =
      remainingBudget > 0
        ? Math.max(60, remainingBudget / remaining)
        : Math.max(60, totalDurationMs / Math.max(1, remaining));

    return base * (0.65 + Math.random() * 0.7);
  }

  function stopLoadTestInternal() {
    if (loadTestControl.timerId) {
      clearTimeout(loadTestControl.timerId);
    }

    loadTestControl.timerId = null;
    loadTestControl.isRunning = false;

    console.log("Load test stopped");
  }

  window.stopLoadTest = function () {
    stopLoadTestInternal();
  };

  window.simulateRoundLoadTest = async function (total = 230) {
    stopLoadTestInternal();

    const durationSeconds = 60;
    const totalDurationMs = durationSeconds * 1000;

    try {
      const gameState = await getCurrentRoundState();
      const round = gameState?.round_number;
      const phase = gameState?.phase;

      if (!round) {
        console.error("No current round number found.");
        return;
      }

      if (phase !== "answering") {
        console.error("Game must be in answering phase before load testing.");
        return;
      }

      console.log(
        `Starting clean load test for ${total} players on round ${round}`,
      );

      await clearOldLoadTestData(round);

      const seededPlayers = await seedPlayers(total);

      if (!seededPlayers.length) {
        console.error("No fake players were seeded.");
        return;
      }

      const playersForAnswers = shuffle(seededPlayers);

      let sent = 0;
      const start = performance.now();

      loadTestControl.isRunning = true;
      loadTestControl.timerId = null;

      async function sendNext() {
        if (!loadTestControl.isRunning) return;

        if (sent >= playersForAnswers.length) {
          loadTestControl.isRunning = false;
          loadTestControl.timerId = null;
          console.log(
            `Done inserting ${playersForAnswers.length}/${playersForAnswers.length} answers`,
          );
          return;
        }

        const player = playersForAnswers[sent];

        const row = {
          name: player.name,
          table_code: player.table_code,
          answer: randomAnswerForRound(round),
          round_number: round,
        };

        const { error } = await client.from("answers").insert([row]);

        if (error) {
          console.error(`Answer insert failed at ${sent + 1}:`, error);
          stopLoadTestInternal();
          return;
        }

        sent++;

        if (sent % 10 === 0 || sent === playersForAnswers.length) {
          console.log(`Inserted ${sent}/${playersForAnswers.length} answers`);
        }

        const elapsed = performance.now() - start;
        const remaining = playersForAnswers.length - sent;
        const nextDelay = getAdaptiveDelay(elapsed, remaining, totalDurationMs);

        loadTestControl.timerId = setTimeout(sendNext, nextDelay);
      }

      sendNext();
    } catch (err) {
      console.error("simulateRoundLoadTest failed:", err);
      stopLoadTestInternal();
    }
  };
}
