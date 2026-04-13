import { callLLM } from "../utils/openai.js";
import { getHarnessPrinciples } from "../utils/harness-principles.js";
import fs from "fs";

export async function developer(plan: any, design: any, feedback?: string) {
  const principles = getHarnessPrinciples();
  const res = await callLLM(
    `You are a frontend developer. Return code only.

Apply these harness engineering principles:
${principles}`,
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
