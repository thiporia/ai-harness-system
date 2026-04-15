import {
  planner,
  designer,
  developer,
  generateCodeSummary,
  tester,
  reviewer,
  reviewPlan,
  reviewDesign,
  reviewCodeVsPlan,
  reviewCodeVsDesign,
} from "./agents/index.js";
import {
  writeAcpFile,
  acpFilePath,
  readAcpSummary,
  buildPlanSummary,
  buildDesignSummary,
  buildDeveloperSummary,
  buildTesterSummary,
  buildReviewSummary,
  extractBuildError,
  enforceSummaryBudget,
  truncateForArchive,
} from "./utils/agent-comms.js";
import fs from "fs";
import path from "path";

interface FeatureItem {
  name: string;
  description: string;
  acceptance_tests: string[];
}

interface Plan {
  features: FeatureItem[];
  acceptance_tests: Array<{ feature: string; tests: string[] }>;
  folder_plan?: string[];
  stack_decision?: { fixed?: string[]; selected?: string[]; rationale?: string[] };
  device_targets?: string[];
  scope?: { in_scope: string[]; out_of_scope: string[] };
}

interface Design {
  components: Array<{ name?: string; props?: string[]; description?: string; design_notes?: string }>;
  design_references_used?: string[];
}

interface TestResult {
  success: boolean;
  logs?: string;
}

interface ReviewAnalysis {
  issue: string;
  fix: string;
}

interface StageReviewResult {
  approved: boolean;
  feedback: string;
}

interface QualityGateResult {
  success: boolean;
  logs: string;
}

interface ReviewEntry {
  attempt: number;
  feedback: string;
  acpFile?: string;
}

interface BuildReport {
  run_id: string;
  created_at: string;
  input: string;
  planner_summary: string;
  planner_review_iterations: number;
  designer_summary: string;
  designer_review_iterations: number;
  developer_attempts: number;
  developer_files: string[];
  reviewer_history: ReviewEntry[];
  quality_gate: { success: boolean; logs: string } | null;
  final_status: "success" | "partial" | "failed";
  failure_reason?: string;
  acp_dir?: string;
}

const MAX_RETRIES = 5;
const DEFAULT_APP_INPUT = "React Todo App with CRUD";
const DOC_ARTIFACTS_DIR = "./docs/artifacts";
const ARTIFACTS_DIR = "./artifacts";

function getRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// ── BUILD_REPORT ───────────────────────────────────────────────

function initBuildReport(runId: string, input: string): BuildReport {
  return {
    run_id: runId,
    created_at: new Date().toISOString(),
    input,
    planner_summary: "",
    planner_review_iterations: 0,
    designer_summary: "",
    designer_review_iterations: 0,
    developer_attempts: 0,
    developer_files: [],
    reviewer_history: [],
    quality_gate: null,
    final_status: "failed",
    acp_dir: `docs/agent-comms/${runId}`,
  };
}

function renderBuildReport(report: BuildReport): string {
  const reviewLines = report.reviewer_history.length
    ? report.reviewer_history
        .map((r) => {
          const acpRef = r.acpFile ? `\n> ACP: \`${r.acpFile}\`` : "";
          return `### 시도 ${r.attempt}\n\n${r.feedback}${acpRef}`;
        })
        .join("\n\n")
    : "_없음_";

  const fileList = report.developer_files.length
    ? report.developer_files.map((f) => `- ${f}`).join("\n")
    : "_없음_";

  const qgStatus = report.quality_gate
    ? `**${report.quality_gate.success ? "✅ 통과" : "❌ 실패"}**\n\`\`\`\n${report.quality_gate.logs}\n\`\`\``
    : "_미실행_";

  const statusLabel =
    report.final_status === "success" ? "✅ 성공"
    : report.final_status === "partial" ? "⚠️ 부분 완료"
    : "❌ 실패";

  return `# Build Report

- **run_id**: ${report.run_id}
- **생성 시각**: ${report.created_at}
- **입력 컨셉**: ${report.input}
- **ACP 통신 기록**: \`${report.acp_dir ?? "docs/agent-comms/" + report.run_id}\`

---

## Planner 요약

- Reviewer 검토 횟수: ${report.planner_review_iterations}

${report.planner_summary || "_없음_"}

---

## Designer 요약

- Reviewer 검토 횟수: ${report.designer_review_iterations}

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

  const reportSrc = path.join(runDir, "BUILD_REPORT.md");
  if (fs.existsSync(reportSrc)) {
    fs.copyFileSync(reportSrc, path.join(latestDir, "BUILD_REPORT.md"));
  }

  fs.writeFileSync(path.join(latestDir, "LATEST_RUN.txt"), path.basename(runDir), "utf-8");
}

// ── 빌드 로그 파일 저장 ─────────────────────────────────────────

function saveBuildLog(runDir: string, attempt: number, logs: string) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, `build-${attempt}.log`), logs, "utf-8");
}

// ── 기획 문서 저장 ─────────────────────────────────────────────

function persistPlanningDocs(input: string, plan: Plan, design: Design) {
  const runId = getRunId();
  const historyDir = `${DOC_ARTIFACTS_DIR}/history`;
  const meta = { run_id: runId, input, created_at: new Date().toISOString() };
  const toText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

  const planFeatures = Array.isArray(plan.features) ? plan.features : [];
  const planTests = Array.isArray(plan.acceptance_tests) ? plan.acceptance_tests : [];
  const designComponents = Array.isArray(design.components) ? design.components : [];

  const featureLines = planFeatures
    .map((item, idx) => {
      if (item && typeof item === "object") {
        const name = "name" in item ? toText((item as any).name) : `기능 ${idx + 1}`;
        const desc = "description" in item ? toText((item as any).description) : "";
        return `- ${name}${desc ? `: ${desc}` : ""}`;
      }
      return `- ${toText(item)}`;
    })
    .join("\n");

  const testLines = planTests
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
    .map((c, idx) => {
      const name = c?.name ? toText(c.name) : `컴포넌트 ${idx + 1}`;
      const props = Array.isArray(c?.props) ? c.props : [];
      const propLines = props.map((p) => `  - ${toText(p)}`).join("\n");
      const notes = c?.design_notes ? `\n  > ${c.design_notes}` : "";
      return `- ${name}${propLines ? `\n${propLines}` : ""}${notes}`;
    })
    .join("\n");

  const designRefs = Array.isArray(design.design_references_used)
    ? design.design_references_used.map((r) => `- ${r}`).join("\n")
    : "_없음_";

  const planMd = `# Planner 결과 문서

- run_id: ${meta.run_id}
- created_at: ${meta.created_at}
- input: ${meta.input}

## 한국어 요약

### 주요 기능
${featureLines || "- (없음)"}

### 수용 테스트(검증 기준)
${testLines || "- (없음)"}

## 원본 JSON

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`
`;

  const designMd = `# Designer 결과 문서

- run_id: ${meta.run_id}
- created_at: ${meta.created_at}
- input: ${meta.input}

## 한국어 요약

### 컴포넌트 구성
${designLines || "- (없음)"}

### 참조한 디자인 레퍼런스
${designRefs}

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

// ── 단계별 실행 ────────────────────────────────────────────────

async function executePlanningStage(
  input: string,
  runId: string,
  report: BuildReport
): Promise<Plan> {
  console.log("\n[1/5] Planning...");
  let plan = (await planner(input)) as Plan;
  console.log("PLAN:", JSON.stringify(plan, null, 2));

  // ACP: 01-planner-output.md
  const plannerAcpPath = writeAcpFile(runId, "01-planner-output.md", {
    frontmatter: { from: "planner", to: "orchestrator", type: "output", run_id: runId, attempt: 1, status: "info" },
    summary: buildPlanSummary(plan),
    details: truncateForArchive(JSON.stringify(plan, null, 2)),
    references: [`docs/artifacts/history/<run-id>-plan.md`],
  });
  console.log(`  → ACP: ${plannerAcpPath}`);

  // Planner cross-review
  for (let i = 0; i < MAX_RETRIES; i++) {
    console.log(`  → reviewPlan (${i + 1}/${MAX_RETRIES})`);
    const review: StageReviewResult = await reviewPlan(plan);
    report.planner_review_iterations = i + 1;

    // ACP: 02-plan-review-N.md
    const reviewAcpPath = writeAcpFile(runId, `02-plan-review-${i + 1}.md`, {
      frontmatter: {
        from: "reviewer",
        to: "planner",
        type: "review",
        run_id: runId,
        attempt: i + 1,
        status: review.approved ? "approved" : "rejected",
      },
      summary: buildReviewSummary(review.approved, review.feedback),
    });
    console.log(`  → ACP: ${reviewAcpPath}`);

    if (review.approved) {
      console.log("  ✅ Plan approved.");
      break;
    }

    console.log(`  ⚠️ Plan rejected: ${review.feedback}`);
    if (i === MAX_RETRIES - 1) {
      console.warn("  ⚠️ Max plan review retries reached. Proceeding with last plan.");
      break;
    }

    // 다음 Planner 호출 시 ACP Summary만 전달 (원본 JSON 아님)
    const reviewSummary = readAcpSummary(reviewAcpPath);
    plan = (await planner(input, reviewSummary)) as Plan;

    // ACP 업데이트
    writeAcpFile(runId, "01-planner-output.md", {
      frontmatter: { from: "planner", to: "orchestrator", type: "output", run_id: runId, attempt: i + 2, status: "info" },
      summary: buildPlanSummary(plan),
      details: truncateForArchive(JSON.stringify(plan, null, 2)),
    });
  }

  report.planner_summary = buildPlanSummary(plan);
  return plan;
}

async function executeDesigningStage(
  plan: Plan,
  runId: string,
  report: BuildReport
): Promise<Design> {
  console.log("\n[2/5] Designing (with awesome-design-md refs)...");
  let design = (await designer(plan)) as Design;
  console.log("DESIGN:", JSON.stringify(design, null, 2));

  // ACP: 03-designer-output.md
  const designerAcpPath = writeAcpFile(runId, "03-designer-output.md", {
    frontmatter: { from: "designer", to: "orchestrator", type: "output", run_id: runId, attempt: 1, status: "info" },
    summary: buildDesignSummary(design),
    details: truncateForArchive(JSON.stringify(design, null, 2)),
  });
  console.log(`  → ACP: ${designerAcpPath}`);

  // Design review
  for (let i = 0; i < MAX_RETRIES; i++) {
    console.log(`  → reviewDesign (${i + 1}/${MAX_RETRIES})`);
    const review: StageReviewResult = await reviewDesign(plan, design);
    report.designer_review_iterations = i + 1;

    // ACP: 04-design-review-N.md
    const reviewAcpPath = writeAcpFile(runId, `04-design-review-${i + 1}.md`, {
      frontmatter: {
        from: "reviewer",
        to: "designer",
        type: "review",
        run_id: runId,
        attempt: i + 1,
        status: review.approved ? "approved" : "rejected",
      },
      summary: buildReviewSummary(review.approved, review.feedback),
    });
    console.log(`  → ACP: ${reviewAcpPath}`);

    if (review.approved) {
      console.log("  ✅ Design approved.");
      break;
    }

    console.log(`  ⚠️ Design rejected: ${review.feedback}`);
    if (i === MAX_RETRIES - 1) {
      console.warn("  ⚠️ Max design review retries reached. Proceeding with last design.");
      break;
    }

    // ACP Summary만 Designer에 전달
    const reviewSummary = readAcpSummary(reviewAcpPath);
    const revisedPlan = { ...plan, _design_feedback: reviewSummary };
    design = (await designer(revisedPlan)) as Design;

    writeAcpFile(runId, "03-designer-output.md", {
      frontmatter: { from: "designer", to: "orchestrator", type: "output", run_id: runId, attempt: i + 2, status: "info" },
      summary: buildDesignSummary(design),
      details: truncateForArchive(JSON.stringify(design, null, 2)),
    });
  }

  report.designer_summary = buildDesignSummary(design);
  return design;
}

async function executeDevelopmentLoop(
  plan: Plan,
  design: Design,
  runId: string,
  runDir: string,
  report: BuildReport
): Promise<boolean> {
  console.log("\n[3-4/5] Developing + Testing...");
  let success = false;
  let retryCount = 0;
  let feedback = "";

  while (!success && retryCount < MAX_RETRIES) {
    const attempt = retryCount + 1;
    console.log(`\n  ── Attempt ${attempt}/${MAX_RETRIES} ──`);

    // ── Phase 1: 코드 생성 ────────────────────────────────────
    const devResult = await developer(plan, design, feedback, runDir);
    report.developer_attempts = attempt;
    report.developer_files = devResult.files;

    // ACP: 05-developer-attempt-N.md
    const devSummary = buildDeveloperSummary(
      devResult.files,
      devResult.npmResult.success,
      devResult.gitResult?.success ?? false
    );
    const devAcpPath = writeAcpFile(runId, `05-developer-attempt-${attempt}.md`, {
      frontmatter: {
        from: "developer",
        to: "orchestrator",
        type: "output",
        run_id: runId,
        attempt,
        status: devResult.npmResult.success ? "success" : "failure",
      },
      summary: devSummary,
      references: [`artifacts/${runId}/`],
    });
    console.log(`  → ACP: ${devAcpPath}`);

    if (!devResult.npmResult.success) {
      console.warn("  [Phase 1] npm install failed → Reviewer");

      // 빌드 로그 별도 저장 (LLM에는 에러 요약만)
      saveBuildLog(runDir, attempt, devResult.npmResult.output ?? "");
      const errorSnippet = extractBuildError(devResult.npmResult.output ?? "");
      feedback = await safeReview(
        `npm install failed:\n${errorSnippet}`,
        "[npm install 실패] package.json의 존재하지 않는 패키지 이름을 확인하고 올바른 패키지명으로 수정하세요."
      );

      // ACP: 07-build-review-N.md
      const fbAcpPath = writeAcpFile(runId, `07-build-review-${attempt}.md`, {
        frontmatter: {
          from: "reviewer",
          to: "developer",
          type: "feedback",
          run_id: runId,
          attempt,
          status: "rejected",
        },
        summary: enforceSummaryBudget(feedback),
        references: [`artifacts/${runId}/build-${attempt}.log`],
      });
      report.reviewer_history.push({ attempt, feedback, acpFile: fbAcpPath });
      retryCount++;
      continue;
    }

    // ── Phase 2: 빌드 게이트 (Tester) ────────────────────────
    console.log("  [Phase 2] Build + E2E + cap sync...");
    const testResult: TestResult = await tester(runDir);
    const testerLogs = testResult.logs ?? "";

    // 빌드 로그 별도 저장
    if (testerLogs) {
      saveBuildLog(runDir, attempt, testerLogs);
    }

    // ACP: 06-tester-result-N.md
    const testerAcpPath = writeAcpFile(runId, `06-tester-result-${attempt}.md`, {
      frontmatter: {
        from: "tester",
        to: "orchestrator",
        type: "output",
        run_id: runId,
        attempt,
        status: testResult.success ? "success" : "failure",
      },
      summary: buildTesterSummary(testResult.success, testerLogs),
      references: testerLogs ? [`artifacts/${runId}/build-${attempt}.log`] : undefined,
    });
    console.log(`  → ACP: ${testerAcpPath}`);

    if (!testResult.success) {
      console.log(`  [Phase 2] ❌ Build failed`);

      // LLM에는 에러 요약만 전달
      const testerSummary = readAcpSummary(testerAcpPath);
      feedback = await safeReview(
        testerSummary,
        "[빌드 실패] TypeScript 컴파일 오류 또는 누락된 import를 확인하고 수정하세요."
      );

      const fbAcpPath = writeAcpFile(runId, `07-build-review-${attempt}.md`, {
        frontmatter: {
          from: "reviewer",
          to: "developer",
          type: "feedback",
          run_id: runId,
          attempt,
          status: "rejected",
        },
        summary: enforceSummaryBudget(feedback),
        references: [`artifacts/${runId}/build-${attempt}.log`],
      });
      report.reviewer_history.push({ attempt, feedback, acpFile: fbAcpPath });
      retryCount++;
      continue;
    }

    console.log("  [Phase 2] ✅ Build passed");

    // ── Phase 3: 의미 검토 — Planner + Designer 병렬 실행 ─────
    console.log("  [Phase 3] Semantic review (Planner + Designer, parallel)...");
    const codeSummary = generateCodeSummary(devResult.files, plan, runDir);

    const [planCodeReview, designCodeReview] = await Promise.all([
      reviewCodeVsPlan(plan, codeSummary),
      reviewCodeVsDesign(design, codeSummary),
    ]);

    const semanticIssues: string[] = [];

    if (!planCodeReview.approved) {
      console.log(`  [Phase 3] ⚠️  Planner: ${planCodeReview.feedback}`);
      semanticIssues.push(`[Planner 검토] ${planCodeReview.feedback}`);
    } else {
      console.log("  [Phase 3] ✅ Planner: implementation matches plan");
    }

    if (!designCodeReview.approved) {
      console.log(`  [Phase 3] ⚠️  Designer: ${designCodeReview.feedback}`);
      semanticIssues.push(`[Designer 검토] ${designCodeReview.feedback}`);
    } else {
      console.log("  [Phase 3] ✅ Designer: component structure matches design");
    }

    // ACP: 08-semantic-review-N.md
    const semanticStatus = semanticIssues.length === 0 ? "approved" : "rejected";
    const semanticSummary = semanticIssues.length === 0
      ? "✅ APPROVED\nPlanner + Designer 모두 승인"
      : `❌ REJECTED\n${semanticIssues.join("\n")}`;

    const semanticAcpPath = writeAcpFile(runId, `08-semantic-review-${attempt}.md`, {
      frontmatter: {
        from: "reviewer",
        to: "developer",
        type: "review",
        run_id: runId,
        attempt,
        status: semanticStatus,
      },
      summary: enforceSummaryBudget(semanticSummary),
    });
    console.log(`  → ACP: ${semanticAcpPath}`);

    if (semanticIssues.length === 0) {
      console.log("  ✅ All phases passed.");
      success = true;
      break;
    }

    // ACP Summary만 feedback으로 전달
    feedback = readAcpSummary(semanticAcpPath);
    report.reviewer_history.push({ attempt, feedback, acpFile: semanticAcpPath });
    retryCount++;
  }

  if (!success) {
    console.log(`\n  ❌ FAILED after ${MAX_RETRIES} attempts.`);
  }

  return success;
}

// reviewer JSON 파싱 실패 시 fallback 피드백으로 루프를 계속 유지
async function safeReview(logs: string, fallback: string): Promise<string> {
  try {
    const analysis = (await reviewer(logs)) as ReviewAnalysis;
    return `Issue: ${analysis.issue}\nFix: ${analysis.fix}`;
  } catch (err) {
    console.warn("  [reviewer] JSON parse failed, using fallback feedback:", (err as Error).message);
    return fallback;
  }
}

function runQualityGates(testLogs: string): QualityGateResult {
  const logs: string[] = [];
  logs.push("[quality-gate] build + e2e already verified by tester");
  logs.push(testLogs);

  const hasDist = fs.existsSync("./dist/orchestrator.js");
  logs.push(`[quality-gate][harness-dist] ${hasDist ? "found" : "missing"} ./dist/orchestrator.js`);
  if (!hasDist) {
    return { success: false, logs: logs.join("\n") };
  }

  return { success: true, logs: logs.join("\n") };
}

// ── 메인 ──────────────────────────────────────────────────────

async function runOrchestrator(input: string): Promise<void> {
  const runId = getRunId();
  const runDir = path.join(ARTIFACTS_DIR, runId);
  const report = initBuildReport(runId, input);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[run: ${runId}]`);
  console.log(`Input: "${input}"`);
  console.log(`Output: ${runDir}`);
  console.log(`ACP: docs/agent-comms/${runId}/`);
  console.log("=".repeat(60));

  try {
    // [1] Planning + cross-review
    const plan = await executePlanningStage(input, runId, report);

    // [2] Designing (awesome-design-md) + review
    const design = await executeDesigningStage(plan, runId, report);

    persistPlanningDocs(input, plan, design);
    console.log(`\nPlanning documents saved under ${DOC_ARTIFACTS_DIR}`);

    fs.mkdirSync(runDir, { recursive: true });
    saveBuildReport(runDir, report);

    // [3-4] Development + Testing loop
    const developmentSuccessful = await executeDevelopmentLoop(plan, design, runId, runDir, report);

    if (developmentSuccessful) {
      // [5] Quality Gate
      console.log("\n[5/5] Quality Gate...");
      const finalTest: TestResult = await tester(runDir);
      const qualityGate = runQualityGates(finalTest.logs ?? "");
      report.quality_gate = qualityGate;

      if (!qualityGate.success) {
        report.final_status = "partial";
        report.failure_reason = "Quality gate 실패";
        console.log("⚠️ Quality gates failed.");
        console.log(qualityGate.logs);
      } else {
        report.final_status = "success";
        console.log("✅ Orchestration complete.");
      }
    } else {
      report.final_status = "failed";
      report.failure_reason = `최대 재시도(${MAX_RETRIES}회) 초과`;
      console.log("❌ Orchestration halted: failed within retries.");
    }
  } catch (error) {
    report.final_status = "failed";
    report.failure_reason = error instanceof Error ? error.message : String(error);
    console.error("\nOrchestration Error:", report.failure_reason);
  } finally {
    saveBuildReport(runDir, report);
    copyToLatest(runDir);
    console.log(`\nBuild report → ${path.join(runDir, "BUILD_REPORT.md")}`);
    console.log(`Latest       → ${path.join(ARTIFACTS_DIR, "latest")}`);
    console.log(`ACP records  → docs/agent-comms/${runId}/`);
  }
}

// CLI 인자 처리
const userInput = process.argv[2] ?? DEFAULT_APP_INPUT;
runOrchestrator(userInput);
