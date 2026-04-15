import { planner, designer, developer, tester, reviewer } from "./agents/index.js";
import fs from "fs";
import path from "path";

interface Plan {
  features: unknown[];
  acceptance_tests: unknown[];
  folder_plan?: unknown[];
  stack_decision?: { fixed?: string[]; selected?: string[]; rationale?: string[] };
}

interface Design {
  components: Array<{ name?: string; props?: unknown[] }>;
}

interface TestResult {
  success: boolean;
  logs?: string;
}

interface ReviewAnalysis {
  issue: string;
  fix: string;
}

interface QualityGateResult {
  success: boolean;
  logs: string;
}

interface ReviewEntry {
  attempt: number;
  feedback: string;
}

interface BuildReport {
  run_id: string;
  created_at: string;
  input: string;
  planner_summary: string;
  designer_summary: string;
  developer_attempts: number;
  developer_files: string[];
  reviewer_history: ReviewEntry[];
  quality_gate: { success: boolean; logs: string } | null;
  final_status: "success" | "partial" | "failed";
  failure_reason?: string;
}

const MAX_DEVELOPMENT_RETRIES = 5;
const DEFAULT_APP_INPUT = "React Todo App with CRUD";
const DOC_ARTIFACTS_DIR = "./docs/artifacts";
const ARTIFACTS_DIR = "./artifacts";

function getRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// ── BUILD_REPORT 헬퍼 ──────────────────────────────────────────

function initBuildReport(runId: string, input: string): BuildReport {
  return {
    run_id: runId,
    created_at: new Date().toISOString(),
    input,
    planner_summary: "",
    designer_summary: "",
    developer_attempts: 0,
    developer_files: [],
    reviewer_history: [],
    quality_gate: null,
    final_status: "failed",
  };
}

function renderBuildReport(report: BuildReport): string {
  const reviewLines = report.reviewer_history.length
    ? report.reviewer_history
        .map((r) => `### 시도 ${r.attempt}\n\n${r.feedback}`)
        .join("\n\n")
    : "_없음_";

  const fileList = report.developer_files.length
    ? report.developer_files.map((f) => `- ${f}`).join("\n")
    : "_없음_";

  const qgStatus = report.quality_gate
    ? `**${report.quality_gate.success ? "✅ 통과" : "❌ 실패"}**\n\`\`\`\n${report.quality_gate.logs}\n\`\`\``
    : "_미실행_";

  const statusLabel =
    report.final_status === "success"
      ? "✅ 성공"
      : report.final_status === "partial"
      ? "⚠️ 부분 완료"
      : "❌ 실패";

  return `# Build Report

- **run_id**: ${report.run_id}
- **생성 시각**: ${report.created_at}
- **입력 컨셉**: ${report.input}

---

## Planner 요약

${report.planner_summary || "_없음_"}

---

## Designer 요약

${report.designer_summary || "_없음_"}

---

## Developer 이력

- **총 시도 횟수**: ${report.developer_attempts}

### 생성된 파일 목록 (최종)

${fileList}

### Reviewer 피드백

${reviewLines}

---

## Quality Gate 결과

${qgStatus}

---

## 최종 상태

${statusLabel}${report.failure_reason ? `\n\n> ${report.failure_reason}` : ""}
`;
}

function saveBuildReport(outputDir: string, report: BuildReport) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "BUILD_REPORT.md"), renderBuildReport(report), "utf-8");
}

function copyToLatest(runDir: string) {
  const latestDir = path.join(ARTIFACTS_DIR, "latest");
  fs.mkdirSync(latestDir, { recursive: true });

  // BUILD_REPORT만 latest에 복사 (프로젝트 전체는 run-id 폴더 참조)
  const reportSrc = path.join(runDir, "BUILD_REPORT.md");
  if (fs.existsSync(reportSrc)) {
    fs.copyFileSync(reportSrc, path.join(latestDir, "BUILD_REPORT.md"));
  }

  // latest/run-id 심볼릭 참조 텍스트 저장
  fs.writeFileSync(
    path.join(latestDir, "LATEST_RUN.txt"),
    path.basename(runDir),
    "utf-8"
  );
}

// ── 기획 문서 저장 (docs/artifacts) ───────────────────────────

function persistPlanningDocs(input: string, plan: Plan, design: Design) {
  const runId = getRunId();
  const historyDir = `${DOC_ARTIFACTS_DIR}/history`;
  const metadata = { run_id: runId, input, created_at: new Date().toISOString() };
  const toText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

  const planFeatures = Array.isArray(plan.features) ? plan.features : [];
  const planTests = Array.isArray(plan.acceptance_tests) ? plan.acceptance_tests : [];
  const designComponents = Array.isArray(design.components) ? design.components : [];

  const planFeatureLines = planFeatures
    .map((item, idx) => {
      if (item && typeof item === "object") {
        const name = "name" in item ? toText((item as any).name) : `기능 ${idx + 1}`;
        const desc = "description" in item ? toText((item as any).description) : "";
        return `- ${name}${desc ? `: ${desc}` : ""}`;
      }
      return `- ${toText(item)}`;
    })
    .join("\n");

  const planTestLines = planTests
    .map((item, idx) => {
      if (item && typeof item === "object") {
        const feature = "feature" in item ? toText((item as any).feature) : `시나리오 ${idx + 1}`;
        const tests = "tests" in item ? (item as any).tests : undefined;
        if (Array.isArray(tests)) {
          return `- ${feature}\n${tests.map((t: unknown) => `  - ${toText(t)}`).join("\n")}`;
        }
        return `- ${feature}`;
      }
      return `- ${toText(item)}`;
    })
    .join("\n");

  const designLines = designComponents
    .map((component, idx) => {
      const name = component?.name ? toText(component.name) : `컴포넌트 ${idx + 1}`;
      const props = Array.isArray(component?.props) ? component.props : [];
      const propLines = props.map((p) => `  - ${toText(p)}`).join("\n");
      return `- ${name}${propLines ? `\n${propLines}` : ""}`;
    })
    .join("\n");

  const planMd = `# Planner 결과 문서

- run_id: ${metadata.run_id}
- created_at: ${metadata.created_at}
- input: ${metadata.input}

## 한국어 요약

### 주요 기능
${planFeatureLines || "- (없음)"}

### 수용 테스트(검증 기준)
${planTestLines || "- (없음)"}

## 원본 JSON

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`
`;

  const designMd = `# Designer 결과 문서

- run_id: ${metadata.run_id}
- created_at: ${metadata.created_at}
- input: ${metadata.input}

## 한국어 요약

### 컴포넌트 구성
${designLines || "- (없음)"}

## 원본 JSON

\`\`\`json
${JSON.stringify(design, null, 2)}
\`\`\`
`;

  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(`${DOC_ARTIFACTS_DIR}/latest-plan.md`, planMd, "utf-8");
  fs.writeFileSync(`${DOC_ARTIFACTS_DIR}/latest-design.md`, designMd, "utf-8");
  fs.writeFileSync(`${historyDir}/${runId}-plan.md`, planMd, "utf-8");
  fs.writeFileSync(`${historyDir}/${runId}-design.md`, designMd, "utf-8");
}

// ── 오케스트레이션 단계 ────────────────────────────────────────

async function executePlanningStage(input: string): Promise<Plan> {
  console.log("Planning...");
  const plan = (await planner(input)) as Plan;
  console.log("PLAN:", JSON.stringify(plan, null, 2));
  return plan;
}

async function executeDesigningStage(plan: Plan): Promise<Design> {
  console.log("\nDesigning...");
  const design = (await designer(plan)) as Design;
  console.log("DESIGN:", JSON.stringify(design, null, 2));
  return design;
}

async function executeDevelopmentLoop(
  plan: Plan,
  design: Design,
  maxRetries: number,
  runDir: string,
  report: BuildReport
): Promise<boolean> {
  let success = false;
  let retryCount = 0;
  let feedback = "";

  while (!success && retryCount < maxRetries) {
    console.log(`\nDevelopment Attempt ${retryCount + 1}/${maxRetries}`);

    const devResult = await developer(plan, design, feedback, runDir);
    report.developer_attempts = retryCount + 1;
    report.developer_files = devResult.files;

    if (!devResult.npmResult.success) {
      console.warn("[orchestrator] npm install failed — passing to reviewer");
      const analysis = (await reviewer(
        `npm install failed:\n${devResult.npmResult.output}`
      )) as ReviewAnalysis;
      feedback = `\nIssue: ${analysis.issue}\nFix: ${analysis.fix}\n`;
      report.reviewer_history.push({ attempt: retryCount + 1, feedback });
      retryCount++;
      continue;
    }

    console.log("Testing (actual build)...");
    const testResult: TestResult = await tester(runDir);

    if (testResult.success) {
      console.log("SUCCESS: Build passed.");
      success = true;
      break;
    }

    console.log(`Build Failed (Attempt ${retryCount + 1}/${maxRetries})`);
    const reviewLogs = testResult.logs || "Unknown build failure";
    const analysis = (await reviewer(reviewLogs)) as ReviewAnalysis;

    feedback = `\nIssue: ${analysis.issue}\nFix: ${analysis.fix}\n`;
    report.reviewer_history.push({ attempt: retryCount + 1, feedback });
    console.log("Reviewer Feedback:", feedback);

    retryCount++;
  }

  if (!success) {
    console.log(`FAILED: Could not build after ${maxRetries} retries.`);
  }

  return success;
}

function runQualityGates(runDir: string, testLogs: string): QualityGateResult {
  const logs: string[] = [];

  // tester가 이미 실제 빌드를 수행했으므로 빌드 결과를 그대로 수용
  logs.push("[quality-gate] build already verified by tester");
  logs.push(testLogs);

  // harness system 자체 dist 확인
  const hasDist = fs.existsSync("./dist/orchestrator.js");
  logs.push(`[quality-gate][dist] ${hasDist ? "found" : "missing"} ./dist/orchestrator.js`);
  if (!hasDist) {
    return { success: false, logs: logs.join("\n") };
  }

  return { success: true, logs: logs.join("\n") };
}

// ── 메인 ──────────────────────────────────────────────────────

async function runOrchestrator(input: string = DEFAULT_APP_INPUT): Promise<void> {
  const runId = getRunId();
  const runDir = path.join(ARTIFACTS_DIR, runId);
  const report = initBuildReport(runId, input);

  console.log(`\n[run: ${runId}] Starting orchestration for: "${input}"`);
  console.log(`Artifact output: ${runDir}\n`);

  let lastTestLogs = "";

  try {
    const plan = await executePlanningStage(input);
    report.planner_summary = Array.isArray(plan.features)
      ? plan.features.map((f: any) => `- ${f?.name ?? JSON.stringify(f)}`).join("\n")
      : JSON.stringify(plan.features);

    const design = await executeDesigningStage(plan);
    report.designer_summary = Array.isArray(design.components)
      ? design.components.map((c) => `- ${c?.name ?? "unnamed"}`).join("\n")
      : JSON.stringify(design.components);

    persistPlanningDocs(input, plan, design);
    console.log(`Planning documents saved under ${DOC_ARTIFACTS_DIR}`);

    fs.mkdirSync(runDir, { recursive: true });
    saveBuildReport(runDir, report);

    const developmentSuccessful = await executeDevelopmentLoop(
      plan,
      design,
      MAX_DEVELOPMENT_RETRIES,
      runDir,
      report
    );

    if (developmentSuccessful) {
      // tester가 이미 성공한 빌드 로그 가져오기
      const finalTest: TestResult = await tester(runDir);
      lastTestLogs = finalTest.logs ?? "";

      const qualityGate = runQualityGates(runDir, lastTestLogs);
      report.quality_gate = qualityGate;

      if (!qualityGate.success) {
        report.final_status = "partial";
        report.failure_reason = "Quality gate 실패";
        console.log("\nOrchestration Halted: Quality gates failed.");
        console.log(qualityGate.logs);
      } else {
        report.final_status = "success";
        console.log("\nOrchestration Complete: Application successfully built.");
      }
    } else {
      report.final_status = "failed";
      report.failure_reason = `최대 재시도(${MAX_DEVELOPMENT_RETRIES}회) 초과`;
      console.log("\nOrchestration Halted: Application failed to build within retries.");
    }
  } catch (error) {
    report.final_status = "failed";
    report.failure_reason = error instanceof Error ? error.message : String(error);
    console.error("\nOrchestration Error:", report.failure_reason);
  } finally {
    saveBuildReport(runDir, report);
    copyToLatest(runDir);
    console.log(`\nBuild report saved: ${path.join(runDir, "BUILD_REPORT.md")}`);
    console.log(`Latest artifact updated: ${path.join(ARTIFACTS_DIR, "latest")}`);
  }
}

runOrchestrator();
