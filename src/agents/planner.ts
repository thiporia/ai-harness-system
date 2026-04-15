/**
 * Planner Agent — Task Decomposition 방식
 *
 * Decompose: feature 이름 목록 획득 (LLM 1회)
 * Execute:   feature당 상세 계획 획득 (LLM N회)
 * Aggregate: 최종 Plan JSON 조합
 */
import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import { parseJsonResponse } from "../utils/json.js";

interface FeatureItem {
  name: string;
  description: string;
  acceptance_tests: string[];
}

interface PlanResult {
  scope: { in_scope: string[]; out_of_scope: string[] };
  device_targets: string[];
  stack_decision: { fixed: string[]; selected: string[]; rationale: string[] };
  folder_plan: string[];
  features: FeatureItem[];
  acceptance_tests: Array<{ feature: string; tests: string[] }>;
}

// ── Step 1: Decompose ─────────────────────────────────────────
// 사용자 컨셉에서 feature 이름 목록과 스택/폴더 기본값 획득 (짧은 호출)

async function decomposeFeatures(input: string, feedback?: string): Promise<{
  features: string[];
  scope: { in_scope: string[]; out_of_scope: string[] };
  device_targets: string[];
  stack_decision: { fixed: string[]; selected: string[]; rationale: string[] };
  folder_plan: string[];
}> {
  const context = getHarnessContext();
  const feedbackSection = feedback ? `\nPrevious feedback:\n${feedback}` : "";

  const res = await callLLM(
    `You are a product planner. Output JSON only — no prose, no markdown.

Apply this harness context:
${context}`,
    `
App concept: ${input}${feedbackSection}

Return a project decomposition:
{
  "features": ["feature name 1", "feature name 2", ...],
  "scope": {
    "in_scope": ["what is included"],
    "out_of_scope": ["what is excluded"]
  },
  "device_targets": ["mobile", "web"],
  "stack_decision": {
    "fixed": ["React", "TypeScript", "Capacitor"],
    "selected": [],
    "rationale": []
  },
  "folder_plan": [
    "src/app",
    "src/features",
    "src/components",
    "src/shared",
    "src/hooks",
    "src/types",
    "tests"
  ]
}

Rules:
- features: 3-8 items, each name ≤30 chars (no descriptions here)
- scope items: ≤60 chars each, max 5 per list
- selected: only essential libraries beyond the fixed baseline (Jotai, Supabase, etc.), max 3
- folder_plan: 5-8 paths, each ≤30 chars
`
  );

  return parseJsonResponse(res);
}

// ── Step 2: Execute ───────────────────────────────────────────
// feature 하나씩 상세 계획 (짧은 호출, 다른 feature의 전체 내용 포함 금지)

async function planFeature(
  featureName: string,
  appConcept: string,
  allFeatureNames: string[],
  stackSelected: string[]
): Promise<FeatureItem> {
  const context = getHarnessContext();

  const res = await callLLM(
    `You are a product planner defining ONE feature in detail. Output JSON only.

Apply this harness context:
${context}`,
    `
App: ${appConcept}
All features in this app: ${allFeatureNames.join(", ")}
Stack: React, TypeScript, Capacitor${stackSelected.length ? ", " + stackSelected.join(", ") : ""}

Define this specific feature in detail:
Feature name: "${featureName}"

Return ONLY this JSON:
{
  "name": "${featureName}",
  "description": "<1 sentence, ≤80 chars>",
  "acceptance_tests": [
    "<Given/When/Then scenario, ≤100 chars each>"
  ]
}

Rules:
- description: ≤80 chars, 1 sentence, focused only on this feature
- acceptance_tests: 2-4 items, each ≤100 chars, Given/When/Then format
`
  );

  return parseJsonResponse<FeatureItem>(res);
}

// ── Aggregate ─────────────────────────────────────────────────
// feature 결과들을 최종 Plan 구조로 조합 (LLM 호출 없음)

function aggregatePlan(
  base: Awaited<ReturnType<typeof decomposeFeatures>>,
  features: FeatureItem[]
): PlanResult {
  const acceptance_tests = features.map((f) => ({
    feature: f.name,
    tests: f.acceptance_tests,
  }));

  return {
    scope: base.scope,
    device_targets: base.device_targets,
    stack_decision: base.stack_decision,
    folder_plan: base.folder_plan,
    features,
    acceptance_tests,
  };
}

// ── Public API ────────────────────────────────────────────────

export async function planner(input: string, feedback?: string): Promise<PlanResult> {
  console.log("  [planner] Decomposing features...");
  const base = await decomposeFeatures(input, feedback);

  console.log(`  [planner] Planning ${base.features.length} features individually...`);
  const featureDetails = await Promise.all(
    base.features.map((name, i) => {
      console.log(`  [planner] Feature ${i + 1}/${base.features.length}: "${name}"`);
      return planFeature(name, input, base.features, base.stack_decision.selected);
    })
  );

  const plan = aggregatePlan(base, featureDetails);
  console.log(`  [planner] Done — ${plan.features.length} features planned.`);
  return plan;
}
