import { planner, designer, developer, tester, reviewer } from "./agents/index.js";

async function run() {
  const input = "React Todo App with CRUD";

  console.log("🧠 Planning...");
  const plan = await planner(input);
  console.log("PLAN:", plan);

  console.log("\n🎨 Designing...");
  const design = await designer(plan);
  console.log("DESIGN:", design);

  let success = false;
  let retry = 0;
  let feedback = "";

  while (!success && retry < 5) {
    console.log(`\n💻 Development Attempt ${retry + 1}`);

    await developer(plan, design, feedback);

    console.log("🧪 Testing...");
    const result = await tester();

    if (result.success) {
      console.log("✅ SUCCESS!");
      success = true;
      break;
    }

    console.log("❌ Test Failed");

    const analysis = await reviewer(result.logs || "Unknown test failure");

    feedback = `
Issue: ${analysis.issue}
Fix: ${analysis.fix}
`;

    retry++;
  }

  if (!success) {
    console.log("🚨 FAILED AFTER MAX RETRIES");
  }
}

run();
