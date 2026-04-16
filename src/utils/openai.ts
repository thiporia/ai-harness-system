import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

type LLMProvider = "openai" | "gemini";

/** Vision 호출용 이미지 데이터 (input-resolver.ImageContent 와 구조 동일) */
export interface VisionImage {
  mimeType: string;
  base64: string;
}

const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase() as LLMProvider;
const openAIModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ── LLM 호출 횟수 추적 & 비용 상한 ────────────────────────────
const MAX_LLM_CALLS = parseInt(process.env.MAX_LLM_CALLS || "150", 10);
let _llmCallCount = 0;

/** 현재까지의 LLM 호출 횟수 반환 */
export function getLLMCallCount(): number {
  return _llmCallCount;
}

function guardCallBudget() {
  _llmCallCount++;
  if (_llmCallCount > MAX_LLM_CALLS) {
    throw new Error(
      `[Cost Guard] LLM 호출 횟수가 상한(${MAX_LLM_CALLS})을 초과했습니다. ` +
      `MAX_LLM_CALLS 환경변수를 늘리거나 입력을 단순화하세요.`
    );
  }
}

// ── Retry with exponential backoff ──────────────────────────────
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message ?? "";
      // 429 Rate Limit / 500+ 서버 에러만 재시도, 나머지는 즉시 throw
      const isRetryable = /429|500|502|503|504|rate.?limit|timeout|ECONNRESET/i.test(msg);
      if (!isRetryable || attempt === MAX_RETRIES) break;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      console.warn(`[${label}] attempt ${attempt}/${MAX_RETRIES} failed (${msg}). Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError!;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env to use ${provider.toUpperCase()} provider.`
    );
  }
  return value;
}

let _openAIClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openAIClient) {
    const apiKey = requireEnv("OPENAI_API_KEY");
    _openAIClient = new OpenAI({ apiKey });
  }
  return _openAIClient;
}

async function callOpenAI(system: string, user: string) {
  const client = getOpenAIClient();
  const res = await client.chat.completions.create({
    model: openAIModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.3
  });

  const content = res.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  return content;
}

async function callGemini(system: string, user: string) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${geminiModel}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: user }]
        }
      ],
      generationConfig: {
        temperature: 0.3
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${message}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("") || "";

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

export async function callLLM(system: string, user: string) {
  guardCallBudget();
  return withRetry(() => {
    if (provider === "gemini") return callGemini(system, user);
    if (provider === "openai") return callOpenAI(system, user);
    throw new Error(`Unsupported LLM_PROVIDER "${provider}". Use "openai" or "gemini".`);
  }, "callLLM");
}

// ── JSON-only API ────────────────────────────────────────────────
// response_format / responseMimeType 으로 모델이 반드시 유효한 JSON을 반환하도록 강제한다.
// 프롬프트에 "Return JSON" 구문이 있어야 정상 동작한다.

async function callOpenAIJson(system: string, user: string): Promise<string> {
  const client = getOpenAIClient();
  const res = await client.chat.completions.create({
    model: openAIModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return content;
}

async function callGeminiJson(system: string, user: string): Promise<string> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${geminiModel}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${message}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("") || "";

  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

/**
 * JSON 응답이 필요한 LLM 호출.
 * - OpenAI: response_format: { type: "json_object" }
 * - Gemini: responseMimeType: "application/json"
 * 반환값은 항상 유효한 JSON 문자열이다.
 */
export async function callLLMJson(system: string, user: string): Promise<string> {
  guardCallBudget();
  return withRetry(() => {
    if (provider === "gemini") return callGeminiJson(system, user);
    if (provider === "openai") return callOpenAIJson(system, user);
    throw new Error(`Unsupported LLM_PROVIDER "${provider}". Use "openai" or "gemini".`);
  }, "callLLMJson");
}

// ── Vision API ───────────────────────────────────────────────────

async function callOpenAIWithVision(system: string, user: string, images: VisionImage[]) {
  const client = getOpenAIClient();

  const imageContent = images.map((img) => ({
    type: "image_url" as const,
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }));

  const res = await client.chat.completions.create({
    model: openAIModel,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [{ type: "text", text: user }, ...imageContent],
      },
    ],
    temperature: 0.3,
  });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return content;
}

async function callGeminiWithVision(system: string, user: string, images: VisionImage[]) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${geminiModel}:generateContent`;

  const imageParts = images.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 },
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        {
          role: "user",
          parts: [{ text: user }, ...imageParts],
        },
      ],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${message}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("") || "";

  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

/**
 * 이미지가 포함된 멀티모달 LLM 호출.
 * images가 비어 있으면 일반 callLLM과 동일하게 동작한다.
 */
export async function callLLMWithVision(system: string, user: string, images: VisionImage[]) {
  if (images.length === 0) return callLLM(system, user);

  guardCallBudget();
  return withRetry(() => {
    if (provider === "gemini") return callGeminiWithVision(system, user, images);
    if (provider === "openai") return callOpenAIWithVision(system, user, images);
    throw new Error(`Unsupported LLM_PROVIDER "${provider}". Use "openai" or "gemini".`);
  }, "callLLMWithVision");
}
