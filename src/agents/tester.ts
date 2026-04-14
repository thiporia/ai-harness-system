import fs from "fs";

export async function tester(targetFile = "./artifacts/App.tsx") {
  if (!fs.existsSync(targetFile)) {
    return {
      success: false,
      logs: `artifact not found: ${targetFile}`
    };
  }

  const code = fs.readFileSync(targetFile, "utf-8");

  const checks: Array<[string, boolean]> = [
    ["has React state", code.includes("useState")],
    ["has input field", /<input[\s>]/i.test(code)],
    ["has add/create action", /(add|create)/i.test(code)],
    ["has delete/remove action", /(delete|remove)/i.test(code)],
    ["has complete/toggle action", /(toggle|complete|done)/i.test(code)],
    ["not trivial null app", !/export\s+default\s+function\s+App\(\)\s*\{\s*return\s+null;?\s*\}/i.test(code)]
  ];

  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length === 0) {
    return { success: true };
  }

  return {
    success: false,
    logs: `failed checks: ${failed.join(", ")}`
  };
}
