/**
 * Designer Agent — Task Decomposition 방식
 *
 * Decompose: component 이름 목록 획득 (LLM 1회)
 * Execute:   component당 상세 설계 획득 (LLM N회)
 * Aggregate: 최종 Design JSON 조합
 */
import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import { parseJsonResponse } from "../utils/json.js";

const AWESOME_DESIGN_MD_API = "https://api.github.com/repos/VoltAgent/awesome-design-md/contents/";
const AWESOME_DESIGN_MD_RAW = "https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/";
const MAX_DESIGN_REFS = 3;

interface GithubContent {
  name: string;
  type: string;
  download_url: string | null;
}

interface ComponentSpec {
  name: string;
  description: string;
  props: string[];
  design_notes: string;
}

interface DesignResult {
  components: ComponentSpec[];
  design_references_used: string[];
}

// ── Design Refs (awesome-design-md) ──────────────────────────

function extractKeywords(plan: any): string[] {
  const keywords: string[] = [];
  const features = Array.isArray(plan.features) ? plan.features : [];

  for (const f of features) {
    if (typeof f === "string") {
      keywords.push(...f.toLowerCase().split(/\W+/));
    } else if (f && typeof f === "object") {
      const name = String(f.name ?? "").toLowerCase();
      const desc = String(f.description ?? "").toLowerCase();
      keywords.push(...name.split(/\W+/), ...desc.split(/\W+/));
    }
  }

  const stopwords = new Set(["the", "a", "an", "and", "or", "for", "to", "of", "in", "with", "on", "at"]);
  return [...new Set(keywords.filter((k) => k.length > 2 && !stopwords.has(k)))];
}

function relevanceScore(filename: string, keywords: string[]): number {
  const lower = filename.toLowerCase().replace(/[-_.]/g, " ");
  return keywords.reduce((score, kw) => (lower.includes(kw) ? score + 1 : score), 0);
}

async function fetchDesignRefs(plan: any): Promise<{ refs: string; usedFiles: string[] }> {
  try {
    const res = await fetch(AWESOME_DESIGN_MD_API, {
      headers: { "User-Agent": "ai-harness-system/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[designer] awesome-design-md API returned ${res.status}`);
      return { refs: "", usedFiles: [] };
    }

    const contents = (await res.json()) as GithubContent[];
    const mdFiles = contents.filter((c) => c.type === "file" && c.name.endsWith(".md"));
    const keywords = extractKeywords(plan);

    const scored = mdFiles
      .map((f) => ({ name: f.name, score: relevanceScore(f.name, keywords) }))
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_DESIGN_REFS);

    if (scored.length === 0) {
      mdFiles.slice(0, MAX_DESIGN_REFS).forEach((f) => scored.push({ name: f.name, score: 0 }));
    }

    const refs: string[] = [];
    const usedFiles: string[] = [];

    for (const { name } of scored) {
      try {
        const rawRes = await fetch(`${AWESOME_DESIGN_MD_RAW}${name}`, {
          signal: AbortSignal.timeout(8_000),
        });
        if (rawRes.ok) {
          const text = await rawRes.text();
          const lines = text.split("\n");
          // 각 ref 파일에서 앞 60줄만 (component당 호출 시 분산)
          const excerpt = lines.slice(0, 60).join("\n");
          refs.push(`### ${name}\n${excerpt}${lines.length > 60 ? "\n...(truncated)" : ""}`);
          usedFiles.push(name);
          console.log(`[designer] Loaded design ref: ${name}`);
        }
      } catch (e) {
        console.warn(`[designer] Failed to fetch ${name}:`, e);
      }
    }

    return { refs: refs.join("\n\n---\n\n"), usedFiles };
  } catch (e) {
    console.warn("[designer] Failed to fetch awesome-design-md:", e);
    return { refs: "", usedFiles: [] };
  }
}

// ── Step 1: Decompose ─────────────────────────────────────────
// feature 목록에서 필요한 component 이름 목록만 획득 (짧은 호출)

async function decomposeComponents(plan: any, feedback?: string): Promise<string[]> {
  const context = getHarnessContext();
  const featureNames = (plan.features ?? []).map((f: any) => f?.name ?? String(f)).join(", ");
  const feedbackSection = feedback ? `\nFeedback to address:\n${feedback}` : "";

  const res = await callLLM(
    `You are a UI designer. Output JSON only.

Apply this harness context:
${context}`,
    `
App features: ${featureNames}
Folder plan: ${(plan.folder_plan ?? []).join(", ")}${feedbackSection}

List all React components needed to implement these features.
Include layout components, feature components, and shared UI components.

Return ONLY this JSON:
{ "components": ["ComponentName1", "ComponentName2", ...] }

Rules:
- ComponentName: PascalCase, ≤30 chars, no descriptions here
- 5-15 components total
- Each maps to one .tsx file
`
  );

  const parsed = parseJsonResponse<{ components: string[] }>(res);
  return parsed.components ?? [];
}

// ── Step 2: Execute ───────────────────────────────────────────
// component 하나씩 상세 설계 (디자인 레퍼런스 포함)

async function designComponent(
  componentName: string,
  plan: any,
  allComponentNames: string[],
  designRef: string
): Promise<ComponentSpec> {
  const context = getHarnessContext();

  // 관련 feature만 추출 (전체 plan JSON 전달 금지)
  const relatedFeatures = (plan.features ?? [])
    .filter((f: any) => {
      const name = (f?.name ?? String(f)).toLowerCase();
      return componentName.toLowerCase().includes(name.split(/\W+/)[0] ?? "") ||
             name.includes(componentName.toLowerCase().slice(0, 5));
    })
    .map((f: any) => f?.name ?? String(f))
    .join(", ") || "general UI";

  const otherComponents = allComponentNames
    .filter((n) => n !== componentName)
    .join(", ");

  const refSection = designRef ? `\nDesign Reference:\n${designRef}` : "";

  const res = await callLLM(
    `You are a UI component designer. Output JSON only.

Apply this harness context:
${context}`,
    `
Design this React component:
Component: "${componentName}"
Related features: ${relatedFeatures}
Other components in this app: ${otherComponents}
Stack: React, TypeScript, mobile-first${refSection}

Return ONLY this JSON:
{
  "name": "${componentName}",
  "description": "<what this component renders, ≤80 chars>",
  "props": ["propName: type"],
  "design_notes": "<mobile layout / key interaction hint, ≤120 chars>"
}

Rules:
- description: ≤80 chars, 1 sentence
- props: 3-6 items, each ≤30 chars (name: type format)
- design_notes: ≤120 chars, 1-2 sentences, mobile-first focus
`
  );

  return parseJsonResponse<ComponentSpec>(res);
}

// ── Aggregate ─────────────────────────────────────────────────

function aggregateDesign(
  components: ComponentSpec[],
  usedFiles: string[]
): DesignResult {
  return {
    components,
    design_references_used: usedFiles,
  };
}

// ── Public API ────────────────────────────────────────────────

export async function designer(plan: any): Promise<DesignResult> {
  // Design refs 획득 (비동기 병렬)
  const [{ refs: designRefs, usedFiles }, componentNames] = await Promise.all([
    fetchDesignRefs(plan),
    decomposeComponents(plan, plan._design_feedback),
  ]);

  console.log(`  [designer] Designing ${componentNames.length} components individually...`);

  // component당 1회 LLM 호출 (순차 — 토큰 병렬 폭발 방지)
  const componentDetails: ComponentSpec[] = [];
  for (let i = 0; i < componentNames.length; i++) {
    const name = componentNames[i]!;
    console.log(`  [designer] Component ${i + 1}/${componentNames.length}: "${name}"`);
    const spec = await designComponent(name, plan, componentNames, designRefs);
    componentDetails.push(spec);
  }

  const design = aggregateDesign(componentDetails, usedFiles);
  console.log(`  [designer] Done — ${design.components.length} components designed.`);
  return design;
}
