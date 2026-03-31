// loadTest.js

if (location.hostname === "localhost") {
  // =========================
  // GLOBAL CONTROL
  // =========================
  window.loadTestControl = {
    timerId: null,
    isRunning: false,
  };

  window.stopLoadTest = function () {
    if (window.loadTestControl.timerId) {
      clearTimeout(window.loadTestControl.timerId);
    }

    window.loadTestControl.timerId = null;
    window.loadTestControl.isRunning = false;

    console.log("Load test stopped");
  };

  // =========================
  // ANSWER GENERATOR
  // =========================
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
    "Testinernernfgeinriegnruehgeighergheiuhgeghegehgehiugheighegheiuheiuhgurghieuheiuheriugheiugheiugheihgeiugheigheigheigheigheihgeigheigheigheigh.",
  ];

  function randomAnswer() {
    return sampleAnswers[Math.floor(Math.random() * sampleAnswers.length)];
  }

  function buildAnswers(total) {
    return Array.from({ length: total }, () => randomAnswer());
  }

  // =========================
  // TIMING (REALISTIC FLOW)
  // =========================
  function nextDelay(elapsedMs) {
    const t = elapsedMs / 1000;

    if (t < 8) return 700 + Math.random() * 1200;
    if (t < 25) return 220 + Math.random() * 380;
    if (t < 45) return 400 + Math.random() * 700;
    return 800 + Math.random() * 1200;
  }

  // =========================
  // VISUAL TEST (NO DB)
  // =========================
  window.simulateRealisticBubbles = function (total = 220) {
    window.stopLoadTest();

    const answers = buildAnswers(total);

    let sent = 0;
    const start = performance.now();

    window.loadTestControl.isRunning = true;

    function sendNext() {
      if (!window.loadTestControl.isRunning) return;

      if (sent >= answers.length) {
        window.loadTestControl.isRunning = false;
        console.log("Done simulating bubbles");
        return;
      }

      spawnAnswerBubble(answers[sent]);
      sent++;

      const elapsed = performance.now() - start;

      window.loadTestControl.timerId = setTimeout(sendNext, nextDelay(elapsed));
    }

    sendNext();
  };

  // =========================
  // DB TEST (REAL FLOW)
  // =========================
  window.simulateRealisticAnswerInserts = async function (
    total = 220,
    round = currentGameState?.round_number,
  ) {
    window.stopLoadTest();

    if (!round) {
      console.error("No current round number found.");
      return;
    }

    const tableCodes = [
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

    const answers = buildAnswers(total);

    let sent = 0;
    const start = performance.now();

    window.loadTestControl.isRunning = true;
    window.loadTestControl.timerId = null;

    async function sendNext() {
      if (!window.loadTestControl.isRunning) return;

      if (sent >= total) {
        window.loadTestControl.isRunning = false;
        window.loadTestControl.timerId = null;
        console.log(`Done inserting ${total} test answers`);
        return;
      }

      const answerText = answers[sent];
      const tableCode = tableCodes[sent % tableCodes.length];

      const row = {
        name: `LoadTestUser${sent + 1}`,
        table_code: tableCode,
        answer: answerText,
        round_number: round,
      };

      const { error } = await client.from("answers").insert([row]);

      if (error) {
        console.error(`Insert failed at ${sent + 1}:`, error);
        window.stopLoadTest();
        return;
      }

      sent++;

      if (sent % 10 === 0 || sent === total) {
        console.log(`Inserted ${sent}/${total}`);
      }

      const elapsed = performance.now() - start;
      window.loadTestControl.timerId = setTimeout(sendNext, nextDelay(elapsed));
    }

    sendNext();
  };
}
