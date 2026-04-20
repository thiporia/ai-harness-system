import fs from "fs";
import path from "path";
import ts from "typescript";

const TARGET = "./artifacts/App.tsx";
const OUT_DIR = "./artifacts/build";
const OUT_FILE = `${OUT_DIR}/App.js`;

function fail(message) {
  console.error(`[artifact-build] ${message}`);
  process.exit(1);
}

function readArtifact(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`artifact not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf-8");
}

function runHeuristicChecks(code) {
  const checks = [
    ["has React state", code.includes("useState")],
    ["has input field", /<input[\s>]/i.test(code)],
    ["has add/create action", /(add|create)/i.test(code)],
    ["has delete/remove action", /(delete|remove)/i.test(code)],
    ["has complete/toggle action", /(toggle|complete|done)/i.test(code)],
    [
      "not trivial null app",
      !/export\s+default\s+function\s+App\(\)\s*\{\s*return\s+null;?\s*\}/i.test(
        code,
      ),
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length > 0) {
    fail(`failed checks: ${failed.join(", ")}`);
  }
}

function transpileTsx(code) {
  const result = ts.transpileModule(code, {
    reportDiagnostics: true,
    fileName: path.resolve(TARGET),
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
    },
  });

  const diagnostics = result.diagnostics || [];
  if (diagnostics.length > 0) {
    const messages = diagnostics.map((d) =>
      ts.flattenDiagnosticMessageText(d.messageText, "\n"),
    );
    fail(`tsx compile failed:\n${messages.join("\n")}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, result.outputText, "utf-8");
}

function run() {
  const code = readArtifact(TARGET);
  runHeuristicChecks(code);
  transpileTsx(code);
  console.log(`[artifact-build] success -> ${OUT_FILE}`);
}

run();
