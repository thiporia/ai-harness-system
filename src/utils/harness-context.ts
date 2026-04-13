import fs from "fs";

const PRINCIPLES_PATH = "./docs/HARNESS_PRINCIPLES.md";
const SPEC_PATH = "./docs/HARNESS_SPEC.md";

function readIfExists(path: string) {
  try {
    return fs.readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

export function getHarnessContext() {
  const principles = readIfExists(PRINCIPLES_PATH);
  const spec = readIfExists(SPEC_PATH);

  return `
[Harness Principles]
${principles}

[Harness Spec]
${spec}
`.trim();
}

