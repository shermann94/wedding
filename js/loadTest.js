// loadTest.js

if (location.hostname === "localhost") {
  const sampleAnswers = [
    "Always communicate honestly, even when it feels uncomfortable.",
    "Never go to bed angry, but also never force a conversation when both of you are too tired.",
    "Happy wife, happy life.",
    "Remember that you are on the same team, even during arguments.",
    "Keep dating each other even after marriage.",
    "Always say thank you for the small things.",
    "Laugh at each other’s bad jokes and life will be easier.",
    "Compromise is important, but so is knowing when to stand your ground kindly.",
    "Choose kindness first, especially on difficult days.",
    "Support each other’s dreams, even the weird ones.",
    "Patience is everything.",
    "Never stop flirting with each other.",
    "Travel together often and make good memories.",
    "Listen more and assume less.",
    "Say sorry quickly and sincerely.",
    "Respect each other’s time, family, and personal space.",
    "Don’t sweat the small things because most things are small things.",
    "Keep the spark alive with little surprises and thoughtful gestures.",
    "Be best friends first and husband and wife second.",
    "Always make time to eat together when you can.",
    "Give each other grace on stressful days.",
    "Don’t compare your marriage to anyone else’s.",
    "Be honest about money, expectations, and feelings.",
    "Sometimes the best advice is to just hug first and argue later.",
    "Pray together, laugh together, and grow together.",
    "Share food, share love, share the blanket fairly.",
    "Celebrate small wins together, not just the big milestones.",
    "Never let outside opinions matter more than your own relationship.",
    "Remember that love is not just a feeling, it is a daily choice.",
    "Communicate clearly because mind reading is not a real skill.",
    "Even when life gets busy, make each other feel chosen.",
    "Be patient when one person is struggling and the other has to carry more.",
    "Keep secrets safe and keep trust sacred.",
    "A soft answer can calm a heated moment faster than winning an argument.",
    "Always protect the peace of your home.",
    "Marriage is less about being right and more about staying connected.",
    "Don’t forget to hug daily.",
    "Learn each other’s love language and actually use it.",
    "Support each other publicly and correct each other privately.",
    "When in doubt, order dessert and talk it out.",
    "Love each other in ways that are meaningful to the other person, not just convenient for yourself.",
    "Be generous with compliments and stingy with harsh words.",
    "Never weaponise each other’s vulnerabilities during arguments.",
    "Keep having fun together, even when life feels very serious.",
    "A marriage works better when both people feel safe, heard, and appreciated.",
    "Sometimes the best marriage advice is simply to be more gentle.",
  ];

  function randomAnswer() {
    return sampleAnswers[Math.floor(Math.random() * sampleAnswers.length)];
  }

  function buildAnswers(total) {
    return Array.from({ length: total }, () => randomAnswer());
  }

  function nextDelay(elapsedMs) {
    const t = elapsedMs / 1000;

    // first few fast responders
    if (t < 8) return 700 + Math.random() * 1200;

    // main wave
    if (t < 25) return 220 + Math.random() * 380;

    // slower middle/late responders
    if (t < 45) return 400 + Math.random() * 700;

    // stragglers
    return 800 + Math.random() * 1200;
  }

  // =========================
  // VISUAL TEST
  // =========================
  window.simulateRealisticBubbles = function (total = 220) {
    const answers = buildAnswers(total);

    let sent = 0;
    const start = performance.now();

    function sendNext() {
      if (sent >= answers.length) {
        console.log("Done simulating bubbles");
        return;
      }

      spawnAnswerBubble(answers[sent]);
      sent++;

      const elapsed = performance.now() - start;
      setTimeout(sendNext, nextDelay(elapsed));
    }

    sendNext();
  };

  // =========================
  // DB TEST
  // This writes to Supabase so your host listener
  // can receive and display answers normally.
  // =========================
  window.simulateRealisticAnswerInserts = async function (
    total = 220,
    round = currentGameState?.round_number,
  ) {
    if (!round) {
      console.error("No current round number found.");
      return;
    }

    const answers = buildAnswers(total);

    let sent = 0;
    const start = performance.now();

    async function sendNext() {
      if (sent >= total) {
        console.log("Done inserting test answers");
        return;
      }

      const answerText = answers[sent];
      sent++;

      const row = {
        name: `LoadTestUser${sent}`,
        table_no: (sent % 23) + 1,
        answer: answerText,
        round_number: round,
      };

      const { error } = await client.from("answers").insert([row]);

      if (error) {
        console.error("Insert failed at", sent, error);
        return;
      }

      if (sent % 10 === 0 || sent === total) {
        console.log(`Inserted ${sent}/${total}`);
      }

      const elapsed = performance.now() - start;
      setTimeout(sendNext, nextDelay(elapsed));
    }

    sendNext();
  };

  // =========================
  // OPTIONAL: COUNT CHECK
  // =========================
  window.checkLoadTestAnswerCount = async function (
    round = currentGameState?.round_number,
  ) {
    if (!round) {
      console.error("No current round number found.");
      return;
    }

    const { count, error } = await client
      .from("answers")
      .select("*", { count: "exact", head: true })
      .eq("round_number", round);

    if (error) {
      console.error("Count check failed", error);
      return;
    }

    console.log(`Round ${round} answer count:`, count);
    return count;
  };

  // =========================
  // OPTIONAL: CLEANUP TEST DATA
  // =========================
  window.clearLoadTestAnswers = async function (
    round = currentGameState?.round_number,
  ) {
    if (!round) {
      console.error("No current round number found.");
      return;
    }

    const { error } = await client
      .from("answers")
      .delete()
      .like("player_name", "LoadTestUser%")
      .eq("round_number", round);

    if (error) {
      console.error("Failed to clear load test answers", error);
      return;
    }

    console.log(`Cleared load test answers for round ${round}`);
  };
}
