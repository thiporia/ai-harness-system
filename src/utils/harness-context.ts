import fs from "fs";

const PRINCIPLES_PATH = "./docs/HARNESS_PRINCIPLES.md";
const SPEC_PATH = "./docs/HARNESS_SPEC.md";

function readIfExists(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

let _cached: string | null = null;

export function getHarnessContext() {
  if (_cached !== null) return _cached;

  const principles = readIfExists(PRINCIPLES_PATH);
  const spec = readIfExists(SPEC_PATH);

  _cached = `
[Harness Principles]
${principles}

[Harness Spec]
${spec}
`.trim();

  return _cached;
}
