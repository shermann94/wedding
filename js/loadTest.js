if (location.hostname === "localhost") {
  const loadTestControl = {
    timerId: null,
    isRunning: false,
    playersSeeded: [],
  };

  const sampleAnswers = [
    "Always communicate honestly, even when it feels uncomfortable.",
    "Never go to bed angry, but also don’t argue when both are tired.",
    "Happy wife, happy life.",
    "Remember you are on the same team.",
    "Keep dating each other even after marriage.",
    "Say thank you for small things.",
    "Laugh at each other’s bad jokes.",
    "Compromise, but don’t lose yourself.",
    "Choose kindness every day.",
    "Support each other’s dreams.",
    "Patience is everything.",
    "Never stop flirting.",
    "Travel together often.",
    "Listen more, assume less.",
    "Say sorry quickly.",
    "Respect each other’s space.",
    "Don’t sweat small things.",
    "Keep the spark alive.",
    "Be best friends first.",
    "Eat together when possible.",
    "Give each other grace.",
    "Don’t compare your marriage.",
    "Be honest about everything.",
    "Hug first, argue later.",
    "Grow together, not apart.",
    "Share food, share love.",
    "Celebrate small wins.",
    "Trust each other fully.",
    "Love is a daily choice.",
    "Communicate clearly always.",
    "Marriage is just teamwork with snacks.",
    "Apologise fast, forgive slowly, order dessert anyway.",
    "Sometimes the best advice is to just hug first.",
    "Lower your voice and raise your standards.",
    "Never underestimate the power of a sincere sorry.",
    "Date nights are cheaper than counselling.",
    "If one is dramatic, the other should not audition too.",
    "Take turns being right.",
    "Love loudly, nag softly.",
    "Argue less, laugh more, split the chores fairly.",
  ];

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

  function randomAnswer() {
    return sampleAnswers[Math.floor(Math.random() * sampleAnswers.length)];
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
      throw new Error("Unable to load room code from game_state.");
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

    const round = currentGameState?.round_number;
    const phase = currentGameState?.phase;
    const durationSeconds = 60;
    const totalDurationMs = durationSeconds * 1000;

    if (!round) {
      console.error("No current round number found.");
      return;
    }

    if (phase !== "answering") {
      console.error("Game must be in answering phase before load testing.");
      return;
    }

    try {
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
          answer: randomAnswer(),
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
