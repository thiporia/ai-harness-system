/**
 * Developer Agent — Task Decomposition 방식
 *
 * Decompose: 생성할 파일 목록 획득 (LLM 1회) → FileSpec[]
 * Execute:   파일당 코드 생성 (LLM N회, 즉시 디스크 기록)
 * Post:      npm install + git commit
 */
import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import { parseJsonResponse } from "../utils/json.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ── 타입 ────────────────────────────────────────────────────────

interface FileSpec {
  path: string;           // 상대 경로 (예: src/components/TodoList.tsx)
  purpose: string;        // 한 줄 설명
  exports: string[];      // export할 식별자 목록
  imports_from?: string[]; // 의존하는 파일 경로 (컨텍스트 공유용)
}

interface GeneratedFile {
  spec: FileSpec;
  content: string;
  success: boolean;
  error?: string;
}

// ── Shell 유틸 ────────────────────────────────────────────────

function runShell(cmd: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd, stdio: "pipe", timeout: 120_000 }).toString();
    return { success: true, output };
  } catch (err: any) {
    return { success: false, output: err?.stderr?.toString() ?? String(err) };
  }
}

// ── Step 1: Decompose ─────────────────────────────────────────
// Plan + Design → 생성할 파일 목록 (코드 없음)

async function decomposeFiles(plan: any, design: any, feedback?: string): Promise<FileSpec[]> {
  const context = getHarnessContext();

  const featureNames = (plan.features ?? []).map((f: any) => f?.name ?? String(f));
  const componentNames = (design.components ?? []).map((c: any) => c?.name ?? "unknown");
  const folderPlan = (plan.folder_plan ?? []).join(", ");
  const stackSelected = (plan.stack_decision?.selected ?? []).join(", ");
  const feedbackSection = feedback ? `\nPrevious reviewer feedback:\n${feedback}` : "";
  const admob = plan.admob
    ? `AdMob: banner=${plan.admob.banner}, interstitial=${plan.admob.interstitial}, rewarded=${plan.admob.rewarded}`
    : "";

  const res = await callLLM(
    `You are a senior frontend developer planning a project. Output JSON only.

Apply this harness context:
${context}`,
    `
Create a complete file manifest for this React+TypeScript+Vite+Capacitor project.

Features: ${featureNames.join(", ")}
Components to implement: ${componentNames.join(", ")}
Folder structure: ${folderPlan}
Extra stack: ${stackSelected || "none"}
${admob}${feedbackSection}

Return a JSON array of ALL files to generate:
[
  {
    "path": "package.json",
    "purpose": "npm project config with vite build scripts",
    "exports": [],
    "imports_from": []
  },
  {
    "path": "src/services/admob.ts",
    "purpose": "AdMob initialization and ad show helpers",
    "exports": ["initAdMob", "showBanner", "showInterstitial", "showRewarded"],
    "imports_from": []
  }
]

Required files to include:
- package.json (with dev/build/preview scripts)
- vite.config.ts
- tsconfig.json
- index.html
- src/main.tsx
- src/App.tsx
- capacitor.config.ts
- src/services/admob.ts (AdMob init + banner/interstitial/rewarded helpers)
- One file per component from the component list
- One hook file per major state concern
- src/types/index.ts (shared types)

Rules:
- path: relative from project root, no leading slash
- purpose: ≤15 words
- exports: array of exported names (empty for config files)
- imports_from: only files defined in THIS manifest
- Do NOT include node_modules, lock files, or dist
- Total: 10-30 files
`
  );

  const parsed = parseJsonResponse<FileSpec[]>(res);
  if (!Array.isArray(parsed)) throw new Error("decomposeFiles: LLM did not return an array");
  return parsed;
}

// ── Step 2: Execute ───────────────────────────────────────────
// 파일 하나씩 코드 생성
// 다른 파일의 전체 코드는 전달하지 않음 — exports 선언만 공유

async function generateFile(
  spec: FileSpec,
  allSpecs: FileSpec[],
  plan: any,
  design: any,
  alreadyGenerated: Map<string, string>  // path → exports 시그니처
): Promise<string> {
  const context = getHarnessContext();

  // 의존 파일의 exports 시그니처만 공유 (전체 코드 금지)
  const depContext = (spec.imports_from ?? [])
    .filter((dep) => alreadyGenerated.has(dep))
    .map((dep) => `- ${dep} → exports: ${alreadyGenerated.get(dep)}`)
    .join("\n");

  // 이 파일과 관련된 feature/component 정보만 추출
  const relatedFeature = (plan.features ?? []).find((f: any) => {
    const name = (f?.name ?? "").toLowerCase();
    return spec.path.toLowerCase().includes(name.split(/\W+/)[0] ?? "____");
  });

  const relatedComponent = (design.components ?? []).find((c: any) =>
    spec.exports.includes(c?.name ?? "____")
  );

  const featureHint = relatedFeature
    ? `Feature: ${relatedFeature.name} — ${relatedFeature.description ?? ""}`
    : "";

  const componentHint = relatedComponent
    ? `Component props: ${(relatedComponent.props ?? []).join(", ")}\nDesign notes: ${relatedComponent.design_notes ?? ""}`
    : "";

  const isConfigFile = spec.exports.length === 0;

  // 설정 파일과 코드 파일은 프롬프트를 다르게 구성
  const taskDescription = isConfigFile
    ? `Generate the config file: ${spec.path}
Purpose: ${spec.purpose}
Stack: React, TypeScript, Vite, Capacitor, ${(plan.stack_decision?.selected ?? []).join(", ") || "no extras"}`
    : `Generate the TypeScript/React file: ${spec.path}
Purpose: ${spec.purpose}
Exports: ${spec.exports.join(", ")}
${featureHint}
${componentHint}
${depContext ? `\nAvailable imports:\n${depContext}` : ""}`;

  const res = await callLLM(
    `You are a senior frontend developer writing ONE file. Output ONLY the file content — no delimiters, no explanation, no markdown fences.

Apply this harness context:
${context}`,
    `${taskDescription}

Requirements:
- Use React 18 + TypeScript strict mode
- Mobile-first styling (use CSS modules or inline styles; no external CSS libraries unless plan specifies)
- No placeholder comments like "// TODO" — implement fully
- Imports must use .js extension for local files (ESM NodeNext)

Output ONLY the raw file content.`
  );

  return res.trim();
}

// ── 파일 저장 ─────────────────────────────────────────────────

function writeFile(filePath: string, content: string, outputDir: string) {
  const absPath = path.join(outputDir, filePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, "utf-8");
}

// ── 코드 요약 (Reviewer용) ────────────────────────────────────

export function generateCodeSummary(filePaths: string[], plan: any, outputDir: string): string {
  const lines: string[] = [];

  const grouped: Record<string, string[]> = {};
  for (const f of filePaths) {
    const dir = path.dirname(f) || ".";
    (grouped[dir] ??= []).push(path.basename(f));
  }

  lines.push("[생성된 파일 목록]");
  for (const [dir, files] of Object.entries(grouped)) {
    lines.push(`  ${dir}/`);
    files.forEach((f) => lines.push(`    - ${f}`));
  }

  const componentNames: string[] = [];
  const compPattern = /export\s+(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9]+)/g;
  for (const f of filePaths) {
    if (!f.endsWith(".tsx") && !f.endsWith(".ts")) continue;
    try {
      const code = fs.readFileSync(path.join(outputDir, f), "utf-8");
      let m: RegExpExecArray | null;
      while ((m = compPattern.exec(code)) !== null) {
        const name = m[1];
        if (name && !componentNames.includes(name)) componentNames.push(name);
      }
      compPattern.lastIndex = 0;
    } catch { /* ignore */ }
  }

  if (componentNames.length > 0) {
    lines.push("\n[감지된 컴포넌트 / 함수]");
    lines.push("  " + componentNames.join(", "));
  }

  const features = Array.isArray(plan.features) ? plan.features : [];
  if (features.length > 0) {
    lines.push("\n[plan features 구현 여부]");
    const allCode = filePaths
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
      .map((f) => {
        try { return fs.readFileSync(path.join(outputDir, f), "utf-8"); } catch { return ""; }
      })
      .join("\n")
      .toLowerCase();

    for (const feature of features) {
      const name: string = typeof feature === "string"
        ? feature
        : (feature as any)?.name ?? JSON.stringify(feature);
      const keywords = name.toLowerCase().split(/\W+/).filter((k: string) => k.length > 2);
      const found = keywords.some((kw: string) => allCode.includes(kw));
      lines.push(`  - ${name}: ${found ? "✅ 감지됨" : "❌ 미감지"}`);
    }
  }

  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────

export async function developer(
  plan: any,
  design: any,
  feedback?: string,
  outputDir: string = "./artifacts"
): Promise<{
  files: string[];
  npmResult: { success: boolean; output: string };
  gitResult: { success: boolean; output: string };
  fileResults: GeneratedFile[];
}> {
  const context = getHarnessContext();

  // ── Phase 1: Decompose ──────────────────────────────────────
  console.log("  [developer] Decomposing file manifest...");
  const fileSpecs = await decomposeFiles(plan, design, feedback);
  console.log(`  [developer] ${fileSpecs.length} files to generate.`);

  fs.mkdirSync(outputDir, { recursive: true });

  // ── Phase 2: Execute — 파일당 LLM 1회 ────────────────────────
  const fileResults: GeneratedFile[] = [];
  const alreadyGenerated = new Map<string, string>(); // path → exports signature

  for (let i = 0; i < fileSpecs.length; i++) {
    const spec = fileSpecs[i]!;
    console.log(`  [developer] [${i + 1}/${fileSpecs.length}] ${spec.path}`);

    try {
      const content = await generateFile(spec, fileSpecs, plan, design, alreadyGenerated);
      writeFile(spec.path, content, outputDir);

      // exports 시그니처 기록 (다음 파일이 참조할 용도)
      const exportsSig = spec.exports.length > 0
        ? spec.exports.join(", ")
        : "(config/no exports)";
      alreadyGenerated.set(spec.path, exportsSig);

      fileResults.push({ spec, content, success: true });
    } catch (err: any) {
      console.warn(`  [developer] ⚠️  Failed: ${spec.path} — ${err?.message}`);
      fileResults.push({ spec, content: "", success: false, error: err?.message });
    }
  }

  const successCount = fileResults.filter((r) => r.success).length;
  console.log(`  [developer] Generated ${successCount}/${fileSpecs.length} files.`);

  // ── Phase 3: npm install ──────────────────────────────────────
  const npmResult = runShell("npm install --prefer-offline", outputDir);
  if (!npmResult.success) {
    console.warn("[developer] npm install failed:", npmResult.output);
  }

  // ── Phase 4: git init + commit ────────────────────────────────
  runShell("git init", outputDir);
  runShell("git add -A", outputDir);
  const gitResult = runShell(
    `git commit -m "feat: initial scaffold by Developer Agent" --author="Developer Agent <agent@harness>"`,
    outputDir
  );

  console.log(`[developer] npm install: ${npmResult.success ? "ok" : "failed"}`);
  console.log(`[developer] git commit: ${gitResult.success ? "ok" : "failed"}`);

  return {
    files: fileResults.filter((r) => r.success).map((r) => r.spec.path),
    npmResult,
    gitResult,
    fileResults,
  };
}
