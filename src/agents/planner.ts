import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import { parseJsonResponse } from "../utils/json.js";

export async function planner(input: string) {
  const context = getHarnessContext();
  const res = await callLLM(
    `You are a planner. Output JSON only.

Apply this harness context:
${context}`,
    `
Create a plan for:
${input}

Return:
{
  "scope": {
    "in_scope": [],
    "out_of_scope": []
  },
  "device_targets": [],
  "stack_decision": {
    "fixed": ["React", "TypeScript", "Capacitor"],
    "selected": [],
    "rationale": []
  },
  "folder_plan": [],
  "features": [],
  "acceptance_tests": []
}
`
  );

  return parseJsonResponse(res);
}
