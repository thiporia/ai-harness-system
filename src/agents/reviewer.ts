import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import { parseJsonResponse } from "../utils/json.js";

// ── 기존: 에러 로그 분석 (Developer 루프용) ──────────────────────

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

// ── 신규: Planner 기획 검토 ──────────────────────────────────────

export async function reviewPlan(plan: any): Promise<{ approved: boolean; feedback: string }> {
  const context = getHarnessContext();
  const res = await callLLM(
    `You are a critical product reviewer. Review the following project plan strictly.
Your job is to catch missing scope, unrealistic goals, incomplete acceptance tests,
and misaligned stack decisions.

Apply this harness context:
${context}`,
    `
Review this plan:
${JSON.stringify(plan, null, 2)}

Evaluation criteria:
1. Are all features clearly scoped with in/out-of-scope defined?
2. Are device targets realistic for the given stack?
3. Does the stack decision align with harness baseline (React, TypeScript, Capacitor)?
4. Is the folder plan realistic and complete?
5. Are acceptance tests verifiable and specific?

Return:
{
  "approved": true or false,
  "issues": ["..."],
  "feedback": "Concise summary of what must be fixed, or 'Plan approved.' if approved."
}
`
  );

  const result = parseJsonResponse<{ approved: boolean; issues: string[]; feedback: string }>(res);
  return {
    approved: result.approved,
    feedback: result.feedback,
  };
}

// ── 신규: Developer 산출물 — Planner 관점 검토 ──────────────────────

export async function reviewCodeVsPlan(
  plan: any,
  codeSummary: string
): Promise<{ approved: boolean; feedback: string }> {
  const context = getHarnessContext();
  const res = await callLLM(
    `You are the original planner reviewing whether your plan was faithfully implemented.
Check if all planned features exist in the generated code.

Apply this harness context:
${context}`,
    `
Original Plan:
${JSON.stringify(plan, null, 2)}

Code Summary (generated project):
${codeSummary}

Evaluation criteria:
1. Are all features from plan.features present in the code? (check file names, component names, keywords)
2. Is the folder structure consistent with plan.folder_plan?
3. Are acceptance test scenarios likely coverable by the implemented code?

Return:
{
  "approved": true or false,
  "missing_features": ["feature names that seem unimplemented"],
  "feedback": "Concise list of what is missing or misimplemented, or 'Implementation matches plan.' if approved."
}
`
  );

  const result = parseJsonResponse<{ approved: boolean; missing_features: string[]; feedback: string }>(res);
  return { approved: result.approved, feedback: result.feedback };
}

// ── 신규: Developer 산출물 — Designer 관점 검토 ──────────────────────

export async function reviewCodeVsDesign(
  design: any,
  codeSummary: string
): Promise<{ approved: boolean; feedback: string }> {
  const context = getHarnessContext();
  const res = await callLLM(
    `You are the original designer reviewing whether your component design was faithfully implemented.
Check if all designed components exist and have correct structure.

Apply this harness context:
${context}`,
    `
Original Design:
${JSON.stringify(design, null, 2)}

Code Summary (generated project):
${codeSummary}

Evaluation criteria:
1. Does each designed component appear in the generated file list?
2. Are component names consistent with the design?
3. Do the key props defined in the design appear to be handled in the code?

Return:
{
  "approved": true or false,
  "missing_components": ["component names missing from code"],
  "feedback": "Concise list of what is missing or misimplemented, or 'Component structure matches design.' if approved."
}
`
  );

  const result = parseJsonResponse<{ approved: boolean; missing_components: string[]; feedback: string }>(res);
  return { approved: result.approved, feedback: result.feedback };
}

// ── 신규: Designer 설계 검토 ──────────────────────────────────────

export async function reviewDesign(plan: any, design: any): Promise<{ approved: boolean; feedback: string }> {
  const context = getHarnessContext();
  const res = await callLLM(
    `You are a critical design reviewer. Review the component design against the plan.
Your job is to catch missing components, misaligned props, and design gaps.

Apply this harness context:
${context}`,
    `
Plan:
${JSON.stringify(plan, null, 2)}

Design:
${JSON.stringify(design, null, 2)}

Evaluation criteria:
1. Does each planned feature map to at least one component?
2. Are component props sufficient to implement the feature?
3. Is the design consistent with the planned folder structure?
4. Are design references appropriately reflected (if any)?

Return:
{
  "approved": true or false,
  "issues": ["..."],
  "feedback": "Concise summary of what must be fixed, or 'Design approved.' if approved."
}
`
  );

  const result = parseJsonResponse<{ approved: boolean; issues: string[]; feedback: string }>(res);
  return {
    approved: result.approved,
    feedback: result.feedback,
  };
}
