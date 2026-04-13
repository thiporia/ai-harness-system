import { callLLM } from "../utils/openai.js";
import { getHarnessPrinciples } from "../utils/harness-principles.js";

export async function reviewer(logs: string) {
  const principles = getHarnessPrinciples();
  const res = await callLLM(
    `You analyze errors and suggest fixes.

Apply these harness engineering principles:
${principles}`,
    `
Error:
${logs}

Return:
{
  "issue": "",
  "fix": ""
}
`
  );

  return JSON.parse(res);
}
