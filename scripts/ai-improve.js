import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
const openAIModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env to use ${provider.toUpperCase()} provider.`
    );
  }
  return value;
}

function buildMessages(codebase) {
  return [
    {
      role: "system",
      content: "You are a senior engineer improving code safely."
    },
    {
      role: "user",
      content: `
Improve this codebase.

Rules:
- Do not break existing logic
- Keep it runnable
- Only improve orchestrator.ts

${codebase}
`
    }
  ];
}

async function callOpenAI(codebase) {
  const client = new OpenAI({
    apiKey: requireEnv("OPENAI_API_KEY")
  });

  const res = await client.chat.completions.create({
    model: openAIModel,
    messages: buildMessages(codebase)
  });

  return res.choices[0].message.content || "";
}

async function callGemini(codebase) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const messages = buildMessages(codebase);
  const system = messages[0].content;
  const user = messages[1].content;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
    {
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
        ]
      })
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${message}`);
  }

  const data = await response.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || ""
  );
}

async function run() {
  const files = fs.readdirSync("./src");

  let codebase = "";

  for (const f of files) {
    const content = fs.readFileSync(`./src/${f}`, "utf-8");
    codebase += `\n// FILE: ${f}\n${content}`;
  }

  const content =
    provider === "gemini" ? await callGemini(codebase) : await callOpenAI(codebase);

  fs.writeFileSync("./src/orchestrator.ts", content);

  console.log("AI improvement applied");
}

run();
