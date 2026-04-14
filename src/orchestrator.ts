import { planner, designer, developer, tester, reviewer } from "./agents/index.js";
import fs from "fs";
import ts from "typescript";

interface Plan {
  features: unknown[];
  acceptance_tests: unknown[];
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

const MAX_DEVELOPMENT_RETRIES = 5;
const DEFAULT_APP_INPUT = "React Todo App with CRUD";
const DOC_ARTIFACTS_DIR = "./docs/artifacts";

function getRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function persistPlanningDocs(input: string, plan: Plan, design: Design) {
  const runId = getRunId();
  const historyDir = `${DOC_ARTIFACTS_DIR}/history`;
  const metadata = {
    run_id: runId,
    input,
    created_at: new Date().toISOString()
  };
  const toText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
  const planFeatures = Array.isArray(plan.features) ? plan.features : [];
  const planTests = Array.isArray(plan.acceptance_tests) ? plan.acceptance_tests : [];
  const designComponents = Array.isArray(design.components) ? design.components : [];

  const planFeatureLines = planFeatures
    .map((item, idx) => {
      if (item && typeof item === "object") {
        const name = "name" in item ? toText((item as { name?: unknown }).name) : `기능 ${idx + 1}`;
        const desc =
          "description" in item ? toText((item as { description?: unknown }).description) : "";
        return `- ${name}${desc ? `: ${desc}` : ""}`;
      }
      return `- ${toText(item)}`;
    })
    .join("\n");

  const planTestLines = planTests
    .map((item, idx) => {
      if (item && typeof item === "object") {
        const feature =
          "feature" in item ? toText((item as { feature?: unknown }).feature) : `시나리오 ${idx + 1}`;
        const tests = "tests" in item ? (item as { tests?: unknown }).tests : undefined;
        if (Array.isArray(tests)) {
          const nested = tests.map((t) => `  - ${toText(t)}`).join("\n");
          return `- ${feature}\n${nested}`;
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

  fs.writeFileSync(
    `${DOC_ARTIFACTS_DIR}/latest-plan.md`,
    planMd,
    "utf-8"
  );
  fs.writeFileSync(
    `${DOC_ARTIFACTS_DIR}/latest-design.md`,
    designMd,
    "utf-8"
  );
  fs.writeFileSync(
    `${historyDir}/${runId}-plan.md`,
    planMd,
    "utf-8"
  );
  fs.writeFileSync(
    `${historyDir}/${runId}-design.md`,
    designMd,
    "utf-8"
  );
}

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
  maxRetries: number
): Promise<boolean> {
  let success = false;
  let retryCount = 0;
  let feedback = "";

  while (!success && retryCount < maxRetries) {
    console.log(`\nDevelopment Attempt ${retryCount + 1}/${maxRetries}`);

    await developer(plan, design, feedback);

    console.log("Testing...");
    const testResult: TestResult = await tester();

    if (testResult.success) {
      console.log("SUCCESS: Application developed and passed tests.");
      success = true;
      break;
    }

    console.log(`Test Failed (Attempt ${retryCount + 1}/${maxRetries})`);
    const reviewLogs = testResult.logs || "Unknown test failure";
    const analysis = (await reviewer(reviewLogs)) as ReviewAnalysis;

    feedback = `\nIssue: ${analysis.issue}\nFix: ${analysis.fix}\n`;
    console.log("Reviewer Feedback:", feedback);

    retryCount++;
  }

  if (!success) {
    console.log(`FAILED: Application could not be developed after ${maxRetries} retries.`);
  }

  return success;
}

function runArtifactBuildPipeline(): QualityGateResult {
  const logs: string[] = [];
  const target = "./artifacts/App.tsx";
  const outDir = "./artifacts/build";
  const outFile = `${outDir}/App.js`;

  if (!fs.existsSync(target)) {
    return { success: false, logs: `artifact not found: ${target}` };
  }

  const code = fs.readFileSync(target, "utf-8");
  const checks: Array<[string, boolean]> = [
    ["has React state", code.includes("useState")],
    ["has input field", /<input[\s>]/i.test(code)],
    ["has add/create action", /(add|create)/i.test(code)],
    ["has delete/remove action", /(delete|remove)/i.test(code)],
    ["has complete/toggle action", /(toggle|complete|done)/i.test(code)],
    ["not trivial null app", !/export\s+default\s+function\s+App\(\)\s*\{\s*return\s+null;?\s*\}/i.test(code)]
  ];

  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length > 0) {
    return { success: false, logs: `failed checks: ${failed.join(", ")}` };
  }

  const result = ts.transpileModule(code, {
    reportDiagnostics: true,
    fileName: target,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true
    }
  });

  const diagnostics = result.diagnostics || [];
  if (diagnostics.length > 0) {
    const messages = diagnostics.map((d) =>
      ts.flattenDiagnosticMessageText(d.messageText, "\n")
    );
    return { success: false, logs: `tsx compile failed:\n${messages.join("\n")}` };
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, result.outputText, "utf-8");
  logs.push(`[artifact-build] success -> ${outFile}`);

  return { success: true, logs: logs.join("\n") };
}

function runQualityGates(): QualityGateResult {
  const logs: string[] = [];

  const artifactBuild = runArtifactBuildPipeline();
  logs.push(artifactBuild.logs);
  if (!artifactBuild.success) {
    return { success: false, logs: logs.join("\n") };
  }

  const hasDist = fs.existsSync("./dist/orchestrator.js");
  logs.push(`[dist] ${hasDist ? "found" : "missing"} ./dist/orchestrator.js`);
  if (!hasDist) {
    return { success: false, logs: logs.join("\n") };
  }

  return { success: true, logs: logs.join("\n") };
}

async function runOrchestrator(input: string = DEFAULT_APP_INPUT): Promise<void> {
  try {
    const plan = await executePlanningStage(input);
    const design = await executeDesigningStage(plan);
    persistPlanningDocs(input, plan, design);
    console.log(`Planning documents saved under ${DOC_ARTIFACTS_DIR}`);
    const developmentSuccessful = await executeDevelopmentLoop(
      plan,
      design,
      MAX_DEVELOPMENT_RETRIES
    );

    if (developmentSuccessful) {
      const qualityGate = runQualityGates();
      if (!qualityGate.success) {
        console.log("\nOrchestration Halted: Quality gates failed.");
        console.log(qualityGate.logs);
        return;
      }
      console.log("\nOrchestration Complete: Application successfully built.");
    } else {
      console.log("\nOrchestration Halted: Application failed to build within retries.");
    }
  } catch (error) {
    console.error("\nOrchestration Error:", error instanceof Error ? error.message : error);
  }
}

runOrchestrator();
