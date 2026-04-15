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

// plan features에서 키워드 추출
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

  const stackSelected = Array.isArray(plan.stack_decision?.selected)
    ? plan.stack_decision.selected
    : [];
  for (const s of stackSelected) {
    keywords.push(String(s).toLowerCase());
  }

  // 의미 없는 단어 제거
  const stopwords = new Set(["the", "a", "an", "and", "or", "for", "to", "of", "in", "with", "on", "at"]);
  return [...new Set(keywords.filter((k) => k.length > 2 && !stopwords.has(k)))];
}

// 파일명과 키워드의 관련도 점수 계산
function relevanceScore(filename: string, keywords: string[]): number {
  const lower = filename.toLowerCase().replace(/[-_.]/g, " ");
  return keywords.reduce((score, kw) => (lower.includes(kw) ? score + 1 : score), 0);
}

async function fetchDesignRefs(plan: any): Promise<string> {
  try {
    const res = await fetch(AWESOME_DESIGN_MD_API, {
      headers: { "User-Agent": "ai-harness-system/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[designer] awesome-design-md API returned ${res.status}`);
      return "";
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
      // 관련 파일 없으면 상위 3개 그냥 사용
      const fallback = mdFiles.slice(0, MAX_DESIGN_REFS);
      scored.push(...fallback.map((f) => ({ name: f.name, score: 0 })));
    }

    const refs: string[] = [];
    for (const { name } of scored) {
      try {
        const rawRes = await fetch(`${AWESOME_DESIGN_MD_RAW}${name}`, {
          signal: AbortSignal.timeout(8_000),
        });
        if (rawRes.ok) {
          const text = await rawRes.text();
          // 너무 길면 앞 100줄만
          const lines = text.split("\n");
          const excerpt = lines.slice(0, 100).join("\n");
          refs.push(`### ${name}\n\n${excerpt}${lines.length > 100 ? "\n\n...(truncated)" : ""}`);
          console.log(`[designer] Loaded design ref: ${name}`);
        }
      } catch (e) {
        console.warn(`[designer] Failed to fetch ${name}:`, e);
      }
    }

    return refs.join("\n\n---\n\n");
  } catch (e) {
    console.warn("[designer] Failed to fetch awesome-design-md:", e);
    return "";
  }
}

export async function designer(plan: any) {
  const context = getHarnessContext();
  const designRefs = await fetchDesignRefs(plan);

  const designRefsSection = designRefs
    ? `\n\n## Design References (from awesome-design-md)\n\n${designRefs}`
    : "";

  const res = await callLLM(
    `You are a UI designer. Output JSON only.

Apply this harness context:
${context}`,
    `
Plan:
${JSON.stringify(plan)}
${designRefsSection}

Based on the plan and any design references above, design the component structure.

Return:
{
  "components": [
    {
      "name": "",
      "description": "",
      "props": [],
      "design_notes": ""
    }
  ],
  "design_references_used": []
}
`
  );

  return parseJsonResponse(res);
}
