import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

type LLMProvider = "openai" | "gemini";

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
