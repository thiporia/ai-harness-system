import fs from "fs";

export async function tester() {
  const code = fs.readFileSync("./artifacts/App.tsx", "utf-8");

  if (code.includes("useState")) {
    return { success: true };
  }

  return {
    success: false,
    logs: "useState not found"
  };
}