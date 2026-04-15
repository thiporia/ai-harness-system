import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import { parseJsonResponse } from "../utils/json.js";
import { extractBuildError } from "../utils/agent-comms.js";

// ── 기존: 에러 로그 분석 (Developer 루프용) ──────────────────────

export async function reviewer(logs: string) {
  const context = getHarnessContext();

  // 에러 핵심 3줄만 추출 (전체 로그 전달 금지)
  const errorSnippet = extractBuildError(logs);

  const res = await callLLM(
    `You analyze build/test errors and suggest fixes. Output JSON only — no prose, no markdown.

Apply this harness context:
${context}`,
    `
Build error (key lines):
${errorSnippet}

Return ONLY this JSON, nothing else:
{
  "issue": "<root cause in ≤80 chars>",
  "fix": "<concrete actionable fix in ≤80 chars>"
}
`
  );

  return parseJsonResponse(res);
}

// ── Planner 기획 검토 ──────────────────────────────────────────

export async function reviewPlan(plan: any): Promise<{ approved: boolean; feedback: string }> {
  const context = getHarnessContext();

  // plan에서 검토에 필요한 핵심 정보만 추출 (전체 JSON 전달 금지)
  const planSummary = {
    features: (plan.features ?? []).map((f: any) => f?.name ?? String(f)),
    scope: plan.scope ?? {},
    device_targets: plan.device_targets ?? [],
    stack_fixed: plan.stack_decision?.fixed ?? [],
    stack_selected: plan.stack_decision?.selected ?? [],
    folder_plan: plan.folder_plan ?? [],
    acceptance_test_count: (plan.acceptance_tests ?? []).length,
  };

  const res = await callLLM(
    `You are a critical product reviewer. Review the project plan strictly.
Catch missing scope, unrealistic goals, incomplete acceptance tests, misaligned stack.

Apply this harness context:
${context}`,
    `
Plan summary:
${JSON.stringify(planSummary, null, 2)}

Evaluation criteria:
1. Are features clearly scoped (in/out-of-scope defined)?
2. Are device targets realistic for React+Capacitor stack?
3. Is the stack aligned with harness baseline?
4. Is the folder plan complete for the features?
5. Are there enough acceptance tests (≥1 per feature)?

Return ONLY this JSON:
{
  "approved": true or false,
  "feedback": "<if rejected: what to fix in ≤200 chars. If approved: 'Plan approved.'>"
}
`
  );

  return parseJsonResponse<{ approved: boolean; feedback: string }>(res);
}

// ── Developer 산출물 — Planner 관점 검토 ────────────────────────

export async function reviewCodeVsPlan(
  plan: any,
  codeSummary: string
): Promise<{ approved: boolean; feedback: string }> {
  const context = getHarnessContext();

  const featureNames = (plan.features ?? []).map((f: any) => f?.name ?? String(f));

  const res = await callLLM(
    `You are reviewing whether a plan was faithfully implemented.
Check if all planned features exist in the generated code.

Apply this harness context:
${context}`,
    `
Planned features: ${featureNames.join(", ")}

Code summary:
${codeSummary}

Check: does each planned feature appear in the code (by file name, component name, or keyword)?

Return ONLY this JSON:
{
  "approved": true or false,
  "feedback": "<if rejected: missing features in ≤200 chars. If approved: 'Implementation matches plan.'>"
}
`
  );

  return parseJsonResponse<{ approved: boolean; feedback: string }>(res);
}

// ── Developer 산출물 — Designer 관점 검토 ───────────────────────

export async function reviewCodeVsDesign(
  design: any,
  codeSummary: string
): Promise<{ approved: boolean; feedback: string }> {
  const context = getHarnessContext();

  const componentNames = (design.components ?? []).map((c: any) => c?.name ?? "unnamed");

  const res = await callLLM(
    `You are reviewing whether a component design was faithfully implemented.
Check if all designed components exist in the generated code.

Apply this harness context:
${context}`,
    `
Designed components: ${componentNames.join(", ")}

Code summary:
${codeSummary}

Check: does each component name appear in the file list or detected component list?

Return ONLY this JSON:
{
  "approved": true or false,
  "feedback": "<if rejected: missing components in ≤200 chars. If approved: 'Component structure matches design.'>"
}
`
  );

  return parseJsonResponse<{ approved: boolean; feedback: string }>(res);
}

// ── Designer 설계 검토 ────────────────────────────────────────

export async function reviewDesign(plan: any, design: any): Promise<{ approved: boolean; feedback: string }> {
  const context = getHarnessContext();

  const featureNames = (plan.features ?? []).map((f: any) => f?.name ?? String(f));
  const componentNames = (design.components ?? []).map((c: any) => c?.name ?? "unnamed");

  const res = await callLLM(
    `You are a critical design reviewer. Review the component design against the plan.
Catch missing components, misaligned props, and design gaps.

Apply this harness context:
${context}`,
    `
Planned features: ${featureNames.join(", ")}
Designed components (${componentNames.length}): ${componentNames.join(", ")}
Folder plan: ${(plan.folder_plan ?? []).join(", ")}

Evaluation criteria:
1. Does each planned feature map to at least one component?
2. Are there enough components to implement all features?
3. Is the component count realistic for the folder plan?

Return ONLY this JSON:
{
  "approved": true or false,
  "feedback": "<if rejected: what is missing in ≤200 chars. If approved: 'Design approved.'>"
}
`
  );

  return parseJsonResponse<{ approved: boolean; feedback: string }>(res);
}
