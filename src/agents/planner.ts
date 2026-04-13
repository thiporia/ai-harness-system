import { callLLM } from "../utils/openai.js";
import { getHarnessPrinciples } from "../utils/harness-principles.js";
import { parseJsonResponse } from "../utils/json.js";

export async function planner(input: string) {
  const principles = getHarnessPrinciples();
  const res = await callLLM(
    `You are a planner. Output JSON only.

Apply these harness engineering principles:
${principles}`,
    `
Create a plan for:
${input}

Return:
{
  "features": [],
  "acceptance_tests": []
}
`
  );

  return parseJsonResponse(res);
}
