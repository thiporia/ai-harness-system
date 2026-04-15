import { callLLM } from "../utils/openai.js";
import { getHarnessContext } from "../utils/harness-context.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// === FILE: <path> === ... === END FILE === 형식 파싱
function parseFileManifest(raw: string): Array<{ filePath: string; content: string }> {
  const results: Array<{ filePath: string; content: string }> = [];
  const pattern = /===\s*FILE:\s*(.+?)\s*===\n([\s\S]*?)===\s*END FILE\s*===/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const filePath = (match[1] ?? "").trim();
    const content = match[2] ?? "";
    // 앞뒤 개행 하나씩만 제거
    const trimmedContent = content.replace(/^\n/, "").replace(/\n$/, "");
    results.push({ filePath, content: trimmedContent });
  }

  return results;
}

function writeFiles(files: Array<{ filePath: string; content: string }>, outputDir: string) {
  for (const { filePath, content } of files) {
    const absPath = path.join(outputDir, filePath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, "utf-8");
  }
}

function runShell(cmd: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd, stdio: "pipe", timeout: 120_000 }).toString();
    return { success: true, output };
  } catch (err: any) {
    return { success: false, output: err?.stderr?.toString() ?? String(err) };
  }
}

export async function developer(
  plan: any,
  design: any,
  feedback?: string,
  outputDir: string = "./artifacts"
): Promise<{ files: string[]; npmResult: { success: boolean; output: string }; gitResult: { success: boolean; output: string } }> {
  const context = getHarnessContext();

  const folderPlan = Array.isArray(plan.folder_plan)
    ? plan.folder_plan.join(", ")
    : JSON.stringify(plan.folder_plan ?? []);

  const stackSelected = Array.isArray(plan.stack_decision?.selected)
    ? plan.stack_decision.selected.join(", ")
    : "";

  const features = Array.isArray(plan.features)
    ? plan.features.map((f: any) => `- ${f?.name ?? JSON.stringify(f)}: ${f?.description ?? ""}`).join("\n")
    : JSON.stringify(plan.features ?? []);

  const components = Array.isArray(design.components)
    ? design.components.map((c: any) => `- ${c?.name ?? "unknown"}: props=[${(c?.props ?? []).join(", ")}]`).join("\n")
    : JSON.stringify(design.components ?? []);

  const res = await callLLM(
    `You are a senior frontend developer. Output ONLY a file manifest — no explanations, no markdown prose.

Apply this harness context:
${context}`,
    `
Generate a complete project for the following plan.

## Input concept
${plan.input ?? "React App"}

## Features
${features}

## Folder plan
${folderPlan}

## Additional stack
${stackSelected || "none"}

## Component design
${components}

## Previous reviewer feedback
${feedback || "none"}

---

Output every file using EXACTLY this delimiter format (no other text):

=== FILE: <relative-path-from-project-root> ===
<file content>
=== END FILE ===

Requirements:
- React + TypeScript + Vite scaffold (vite.config.ts, tsconfig.json, index.html, src/main.tsx)
- package.json with scripts: { "dev": "vite", "build": "vite build", "preview": "vite preview" }
- capacitor.config.ts included
- Follow the folder plan strictly (${folderPlan})
- Implement ALL features from the plan
- Use useState / useReducer as needed (no external state lib unless plan specifies)
- Each component in its own file under the correct folder
- No single-file App-only output — the full project structure is required
- Do NOT include node_modules or lock files
`
  );

  const files = parseFileManifest(res);

  if (files.length === 0) {
    throw new Error("Developer LLM returned no parseable files. Raw output:\n" + res.slice(0, 500));
  }

  fs.mkdirSync(outputDir, { recursive: true });
  writeFiles(files, outputDir);

  // npm install
  const npmResult = runShell("npm install --prefer-offline", outputDir);
  if (!npmResult.success) {
    console.warn("[developer] npm install failed:", npmResult.output);
  }

  // git init + initial commit
  runShell("git init", outputDir);
  runShell("git add -A", outputDir);
  const gitResult = runShell(
    `git commit -m "feat: initial scaffold by Developer Agent" --author="Developer Agent <agent@harness>"`,
    outputDir
  );

  console.log(`[developer] wrote ${files.length} files to ${outputDir}`);
  console.log(`[developer] npm install: ${npmResult.success ? "ok" : "failed"}`);
  console.log(`[developer] git commit: ${gitResult.success ? "ok" : "failed"}`);

  return {
    files: files.map((f) => f.filePath),
    npmResult,
    gitResult,
  };
}
