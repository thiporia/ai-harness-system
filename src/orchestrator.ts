import { planner, designer, developer, tester, reviewer } from "./agents/index.js";
import fs from "fs";
import { spawnSync } from "node:child_process";

interface Plan {
  features: string[];
  acceptance_tests: string[];
}

interface Design {
  components: Array<{ name: string; props: string[] }>;
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
  const planMd = `# Planner Result

- run_id: ${metadata.run_id}
- created_at: ${metadata.created_at}
- input: ${metadata.input}

## JSON

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`
`;
  const designMd = `# Designer Result

- run_id: ${metadata.run_id}
- created_at: ${metadata.created_at}
- input: ${metadata.input}

## JSON

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

function runCommand(command: string, args: string[]) {
  return spawnSync(command, args, {
    encoding: "utf-8",
    stdio: "pipe"
  });
}

function runQualityGates(): QualityGateResult {
  const logs: string[] = [];

  const build = runCommand("npm", ["run", "build"]);
  logs.push(`[build:status] ${build.status}`);
  if (build.stdout) logs.push(build.stdout);
  if (build.stderr) logs.push(build.stderr);
  if (build.status !== 0) {
    return { success: false, logs: logs.join("\n") };
  }

  const hasDist = fs.existsSync("./dist/orchestrator.js");
  logs.push(`[dist] ${hasDist ? "found" : "missing"} ./dist/orchestrator.js`);
  if (!hasDist) {
    return { success: false, logs: logs.join("\n") };
  }

  const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8")) as {
    scripts?: Record<string, string>;
  };
  const testScript = packageJson.scripts?.test || "";
  const isPlaceholder = testScript.includes("no test specified");
  if (!isPlaceholder) {
    const test = runCommand("npm", ["run", "test"]);
    logs.push(`[test:status] ${test.status}`);
    if (test.stdout) logs.push(test.stdout);
    if (test.stderr) logs.push(test.stderr);
    if (test.status !== 0) {
      return { success: false, logs: logs.join("\n") };
    }
  } else {
    logs.push("[test] skipped placeholder test script");
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
