import { planner, designer, developer, tester, reviewer } from "./agents/index.js";

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

const MAX_DEVELOPMENT_RETRIES = 5;
const DEFAULT_APP_INPUT = "React Todo App with CRUD";

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

async function runOrchestrator(input: string = DEFAULT_APP_INPUT) {
  try {
    const plan = await executePlanningStage(input);
    const design = await executeDesigningStage(plan);
    const developmentSuccessful = await executeDevelopmentLoop(
      plan,
      design,
      MAX_DEVELOPMENT_RETRIES
    );

    if (developmentSuccessful) {
      console.log("\nOrchestration Complete: Application successfully built.");
    } else {
      console.log("\nOrchestration Halted: Application failed to build within retries.");
    }
  } catch (error) {
    console.error("\nOrchestration Error:", error);
  }
}

runOrchestrator();
