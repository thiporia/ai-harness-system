import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import { parseJsonResponse } from "../utils/json.js";

export async function designer(plan: any) {
  const context = getHarnessContext();
  const res = await callLLM(
    `You are a UI designer. Output JSON only.

Apply this harness context:
${context}`,
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
