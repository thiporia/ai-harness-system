import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import fs from "fs";

function extractCode(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:tsx|typescript|ts|jsx|javascript)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ? fenced[1] : trimmed).trim();
}

export async function developer(plan: any, design: any, feedback?: string) {
  const context = getHarnessContext();
  const res = await callLLM(
    `You are a frontend developer. Return code only.

Apply this harness context:
${context}`,
    `
Plan:
${JSON.stringify(plan)}

Design:
${JSON.stringify(design)}

Feedback:
${feedback || "none"}

Generate a React Todo App in a single file component (App.tsx).

Hard requirements:
- TypeScript + React component code only (no markdown, no explanations)
- Must use useState
- Must include input UI for todo text
- Must implement Add, Edit, Delete, Toggle Complete actions
- Do not return null as the whole app
- Keep code self-contained in one file
`
  );

  const code = extractCode(res);
  fs.mkdirSync("./artifacts", { recursive: true });
  fs.writeFileSync("./artifacts/App.tsx", code);

  return code;
}
