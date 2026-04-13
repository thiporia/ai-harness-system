import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function run() {
  const files = fs.readdirSync("./src");

  let codebase = "";

  for (const f of files) {
    const content = fs.readFileSync(`./src/${f}`, "utf-8");
    codebase += `\n// FILE: ${f}\n${content}`;
  }

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
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
    ]
  });

  fs.writeFileSync("./src/orchestrator.ts", res.choices[0].message.content);

  console.log("✅ AI improvement applied");
}

run();