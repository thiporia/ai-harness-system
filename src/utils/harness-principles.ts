import fs from "fs";

const PRINCIPLES_PATH = "./docs/HARNESS_PRINCIPLES.md";

export function getHarnessPrinciples() {
  try {
    return fs.readFileSync(PRINCIPLES_PATH, "utf-8");
  } catch {
    return "";
  }
}
