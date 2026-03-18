import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.5-flash-lite";
const MAX_RETRIES = 3;

function isValidRequestBody(scenario, answers) {
  return (
    typeof scenario === "string" &&
    scenario.trim().length > 0 &&
    Array.isArray(answers) &&
    answers.length > 0
  );
}

function normalizeAnswers(answers) {
  return answers
    .map((answer) => String(answer ?? "").trim())
    .filter((answer) => answer.length > 0);
}

function buildPrompt(scenario, answers) {
  const formattedAnswers = answers
    .map((answer, index) => `${index}. ${answer}`)
    .join("\n");

  return `
You are a witty wedding emcee judging a party game.

Pick exactly ONE winner.

Rules:
- If at least one answer is understandable, NEVER pick gibberish.
- Only pick gibberish if ALL answers are gibberish.

Judge by:
1. Clear and understandable
2. Relevant to the scenario
3. Amusing or interesting

Guidelines:
- A weak real answer beats any nonsense
- Do NOT claim gibberish is good or meaningful
- Do NOT repeat the answer in your reason

Output JSON:
{ "winner_index": number, "reason": string }

Reason rules:
- 6–12 words
- Casual, light, wedding-appropriate tone

If winner is REAL:
- Give a short meaningful reason

If winner is GIBBERISH:
- Pick ONE from this list exactly:
  1. "I’m not entirely sure what that was, but okay"
  2. "Well… that was something unexpected, I guess"
  3. "I have questions, but we’ll just go with it"
  4. "Not sure what I heard, but it made me pause"
  5. "That was confusing, but oddly memorable"

Return only valid JSON:
{ "winner_index": number, "reason": "short host-style line" }

Scenario:
${scenario}

Answers:
${formattedAnswers}
`.trim();
}

function createModel() {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.5,
      responseMimeType: "application/json",
      maxOutputTokens: 120,
    },
  });
}

function parseModelResponse(text, answerCount) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new Error("AI returned invalid JSON");
    error.status = 500;
    error.details = { raw: text };
    throw error;
  }

  const winnerIndex = Number(parsed?.winner_index);

  if (
    !Number.isInteger(winnerIndex) ||
    winnerIndex < 0 ||
    winnerIndex >= answerCount
  ) {
    const error = new Error("AI returned invalid winner_index");
    error.status = 500;
    error.details = { parsed };
    throw error;
  }

  return {
    received_count: answerCount,
    winner_index: winnerIndex,
    reason:
      typeof parsed?.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "This answer was the funniest.",
  };
}

function isRetryableError(message = "") {
  const lower = message.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(prompt, answerCount) {
  const model = createModel();
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      console.log("Gemini raw response:", text);

      return parseModelResponse(text, answerCount);
    } catch (error) {
      lastError = error;
      const message = error?.message || "";

      console.error(`Gemini attempt ${attempt} failed:`, message);

      if (attempt < MAX_RETRIES && isRetryableError(message)) {
        await sleep(1500 * attempt);
        continue;
      }

      if (isRetryableError(message)) {
        const retryError = new Error("Gemini quota or rate limit hit");
        retryError.status = 429;
        retryError.details = message;
        throw retryError;
      }

      throw error;
    }
  }

  throw lastError || new Error("Unknown Gemini error");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { scenario, answers } = req.body;

    console.log("Incoming scenario:", scenario);
    console.log("Incoming answers count:", answers?.length);

    if (!isValidRequestBody(scenario, answers)) {
      return res.status(400).json({ error: "Missing scenario or answers" });
    }

    const cleanedAnswers = normalizeAnswers(answers);

    if (cleanedAnswers.length === 0) {
      return res.status(400).json({ error: "No valid answers provided" });
    }

    const prompt = buildPrompt(scenario.trim(), cleanedAnswers);
    const result = await generateWithRetry(prompt, cleanedAnswers.length);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Server error:", error);

    return res.status(error?.status || 500).json({
      error: error?.message || "Server error",
      details: error?.details || error?.message || "Unknown error",
    });
  }
}
