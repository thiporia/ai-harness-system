import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import fs from "fs";

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

Generate a React Todo App (single file).
`
  );

  fs.mkdirSync("./artifacts", { recursive: true });
  fs.writeFileSync("./artifacts/App.tsx", res);

  return res;
}
