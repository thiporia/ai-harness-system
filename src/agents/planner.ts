/**
 * Planner Agent — Task Decomposition 방식
 *
 * Decompose: feature 이름 목록 획득 (LLM 1회)
 * Execute:   feature당 상세 계획 획득 (LLM N회)
 * Aggregate: 최종 Plan JSON 조합
 */
import { callLLMJson, callLLMWithVision } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import { parseJsonResponse } from "../utils/json.js";
import type { InputContext } from "../utils/input-resolver.js";

interface FeatureItem {
  name: string;
  description: string;
  acceptance_tests: string[];
}

interface AdMobPlan {
  banner: string;
  interstitial: string;
  rewarded: string;
}

interface PlanResult {
  scope: { in_scope: string[]; out_of_scope: string[] };
  device_targets: string[];
  stack_decision: { fixed: string[]; selected: string[]; rationale: string[] };
  folder_plan: string[];
  features: FeatureItem[];
  acceptance_tests: Array<{ feature: string; tests: string[] }>;
  admob: AdMobPlan;
}

// ── Step 1: Decompose ─────────────────────────────────────────
// 사용자 컨셉에서 feature 이름 목록과 스택/폴더 기본값 획득 (짧은 호출)

async function decomposeFeatures(ctx: InputContext, feedback?: string): Promise<{
  features: string[];
  scope: { in_scope: string[]; out_of_scope: string[] };
  device_targets: string[];
  stack_decision: { fixed: string[]; selected: string[]; rationale: string[] };
  folder_plan: string[];
  admob: AdMobPlan;
}> {
  const context = getHarnessContext();
  const feedbackSection = feedback ? `\nPrevious feedback:\n${feedback}` : "";

  const systemPrompt = `You are a product planner. Output JSON only — no prose, no markdown.

Apply this harness context:
${context}`;

  const userPrompt = `
App concept: ${ctx.textContent}${feedbackSection}

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
    "src/services",
    "tests"
  ],
  "admob": {
    "banner": "bottom of screen, app-wide",
    "interstitial": "<trigger: e.g. after saving an item>",
    "rewarded": "<trigger: e.g. unlock premium feature>"
  }
}

Rules:
- features: 3-8 items, each name ≤30 chars (no descriptions here)
- scope items: ≤60 chars each, max 5 per list
- selected: essential libraries beyond the fixed baseline (Jotai, Firebase, Supabase, Recharts, etc.), max 5
  - If input mentions Firebase → include "Firebase" in selected; do NOT include Supabase
  - If no backend mentioned → include "Supabase" as default
  - Include charting library (Recharts) only if data visualization is explicitly required
- folder_plan: must include "src/services" (for admob.ts), 5-8 paths total, each ≤30 chars
- admob: if the input document specifies exact AdMob positions, use them verbatim; otherwise choose natural positions. interstitial ≤20 chars, rewarded ≤30 chars
- PHASE SCOPE: if the input contains a phase directive (e.g. "Phase 1만 구현", "MVP only", "Phase 2·3는 out-of-scope"), you MUST restrict features to that phase only. Features from excluded phases go into out_of_scope, not features list.
`;

  // 이미지가 있으면 vision API 사용 (와이어프레임, 스크린샷 등)
  const res = await callLLMWithVision(systemPrompt, userPrompt, ctx.images);
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

  const res = await callLLMJson(
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
    admob: base.admob,
  };
}

// ── 동시성 제한 유틸 ─────────────────────────────────────────
const CONCURRENCY_LIMIT = 3;

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx]!, idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Public API ────────────────────────────────────────────────

export async function planner(ctx: InputContext, feedback?: string): Promise<PlanResult> {
  console.log("  [planner] Decomposing features...");
  if (ctx.images.length > 0) {
    console.log(`  [planner] Vision mode: ${ctx.images.length} image(s) attached.`);
  }
  const base = await decomposeFeatures(ctx, feedback);

  console.log(`  [planner] Planning ${base.features.length} features individually (concurrency=${CONCURRENCY_LIMIT})...`);
  const featureDetails = await mapWithLimit(base.features, CONCURRENCY_LIMIT, (name, i) => {
    console.log(`  [planner] Feature ${i + 1}/${base.features.length}: "${name}"`);
    return planFeature(name, ctx.textContent, base.features, base.stack_decision.selected);
  });

  const plan = aggregatePlan(base, featureDetails);
  console.log(`  [planner] Done — ${plan.features.length} features planned.`);
  return plan;
}
