import { callLLM } from "../utils/openai.js";
import { getHarnessPrinciples } from "../utils/harness-principles.js";
import { parseJsonResponse } from "../utils/json.js";

export async function designer(plan: any) {
  const principles = getHarnessPrinciples();
  const res = await callLLM(
    `You are a UI designer. Output JSON only.

Apply these harness engineering principles:
${principles}`,
    `
Plan:
${JSON.stringify(plan)}

Return:
{
  "components": [
    { "name": "", "props": [] }
  ]
}
`
  );

  return parseJsonResponse(res);
}
