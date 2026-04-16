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

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env to use ${provider.toUpperCase()} provider.`
    );
  }
  return value;
}

function createOpenAIClient() {
  const apiKey = requireEnv("OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

async function callOpenAI(system: string, user: string) {
  const client = createOpenAIClient();
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
    `${geminiModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
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
  if (provider === "gemini") {
    return callGemini(system, user);
  }

  if (provider === "openai") {
    return callOpenAI(system, user);
  }

  throw new Error(
    `Unsupported LLM_PROVIDER "${provider}". Use "openai" or "gemini".`
  );
}

// ── Vision API ───────────────────────────────────────────────────

async function callOpenAIWithVision(system: string, user: string, images: VisionImage[]) {
  const client = createOpenAIClient();

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
    `${geminiModel}:generateContent?key=${apiKey}`;

  const imageParts = images.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 },
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  if (provider === "gemini") {
    return callGeminiWithVision(system, user, images);
  }

  if (provider === "openai") {
    return callOpenAIWithVision(system, user, images);
  }

  throw new Error(
    `Unsupported LLM_PROVIDER "${provider}". Use "openai" or "gemini".`
  );
}
