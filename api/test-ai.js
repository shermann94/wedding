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
You are a witty wedding emcee judging a party game called Marriage AIdvice.

The couple is Shermann and Vera. Guests submitted advice for a scenario the couple faced.

Pick exactly ONE winning answer.

Rules:
- If at least one answer is understandable, NEVER pick gibberish.
- Only pick gibberish if ALL answers are gibberish.
- Avoid answers that are vague, non-committal, or do not lead to a clear outcome
- Prefer answers that suggest a clear, realistic, or actionable outcome
- NEVER pick answers containing vulgarities, insults, slurs, or inappropriate language.

Your job:
Pick the answer that would make guests laugh or nod in agreement.

Output JSON:
{ "winner_index": number, "reason": string }

REASON STYLE:
- 8–16 words
- Funny, natural, slightly cheeky
- Sounds like something a human would say out loud
- Use simple, everyday language
- The reason should feel like a humorous reaction, not an explanation
- Make it specific to the exact answer and scenario
- Mention the tension, consequence, or relationship dynamic when possible
- Avoid generic slogans or broad statements that could fit any answer
- Avoid robotic or judging phrases
- Avoid overly dramatic, poetic, or philosophical phrasing
- Do NOT use metaphors, analogies, or comparisons
- Keep it playful and relatable
- Vary sentence openings; avoid starting with "Because"

Good examples:
- "This feels a bit too real already"
- "You just know this is going to backfire"
- "That sounds like something he would actually try"
- "This is how arguments quietly begin"
- "This is not a solution, this is damage control"

If winner is GIBBERISH, pick ONE exactly:
1. "I'm not entirely sure what that was, but okay"
2. "Well… that was something unexpected, I guess"
3. "I have questions, but we'll just go with it"
4. "Not sure what I heard, but it made me pause"
5. "That was confusing, but oddly memorable"

Return only valid JSON:
{ "winner_index": number, "reason": "short funny line" }

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
      maxOutputTokens: 300,
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
