import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.5-flash-lite";
const MAX_RETRIES = 3;

function isValidRequestBody(scenario, answers) {
  return !!scenario && Array.isArray(answers) && answers.length > 0;
}

function normalizeAnswers(answers) {
  return answers.map((answer) => String(answer ?? "").trim());
}

function buildPrompt(scenario, answers) {
  const formattedAnswers = answers
    .map((answer, index) => `${index}. ${answer}`)
    .join("\n");

  return `
Pick the funniest wedding-safe answer.

Return JSON:
{ "winner_index": number, "reason": "short reason" }

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

  if (
    typeof parsed?.winner_index !== "number" ||
    parsed.winner_index < 0 ||
    parsed.winner_index >= answerCount
  ) {
    const error = new Error("AI returned invalid winner_index");
    error.status = 500;
    error.details = { parsed };
    throw error;
  }

  return {
    received_count: answerCount,
    winner_index: parsed.winner_index,
    reason:
      typeof parsed?.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "This answer was the funniest.",
  };
}

function isRetryableError(message) {
  const lower = message.toLowerCase();
  return message.includes("429") || lower.includes("quota");
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
    const prompt = buildPrompt(scenario, cleanedAnswers);
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
