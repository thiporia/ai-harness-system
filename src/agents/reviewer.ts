import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import { parseJsonResponse } from "../utils/json.js";

export async function reviewer(logs: string) {
  const context = getHarnessContext();
  const res = await callLLM(
    `You analyze errors and suggest fixes.

Apply this harness context:
${context}`,
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

  return parseJsonResponse(res);
}
