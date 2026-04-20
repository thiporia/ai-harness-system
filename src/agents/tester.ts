import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";

interface TestResult {
  success: boolean;
  logs: string;
}

function runShell(
  cmd: string,
  cwd: string,
  timeoutMs = 180_000,
): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd,
      stdio: "pipe",
      timeout: timeoutMs,
    }).toString();
    return { success: true, output };
  } catch (err: any) {
    const stderr = err?.stderr?.toString() ?? "";
    const stdout = err?.stdout?.toString() ?? "";
    return {
      success: false,
      output: [stdout, stderr].filter(Boolean).join("\n"),
    };
  }
}

async function waitForServer(
  url: string,
  timeoutMs = 30_000,
): Promise<boolean> {
  const interval = 500;
  const attempts = Math.floor(timeoutMs / interval);

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.status < 500) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

async function runWebE2E(runDir: string, logs: string[]): Promise<boolean> {
  const previewPort = 4173;
  const previewUrl = `http://localhost:${previewPort}`;

  logs.push("[tester:e2e] Starting vite preview server...");

  const previewProc = spawn(
    "npm",
    ["run", "preview", "--", "--port", String(previewPort)],
    {
      cwd: runDir,
      stdio: "pipe",
      detached: false,
    },
  );

  let serverOutput = "";
  previewProc.stdout?.on("data", (d: Buffer) => {
    serverOutput += d.toString();
  });
  previewProc.stderr?.on("data", (d: Buffer) => {
    serverOutput += d.toString();
  });

  try {
    const ready = await waitForServer(previewUrl, 30_000);
    if (!ready) {
      logs.push(
        `[tester:e2e] Server did not start within 30s\n${serverOutput}`,
      );
      return false;
    }

    logs.push(`[tester:e2e] Server ready at ${previewUrl}`);

    // 기본 HTML 응답 확인
    const res = await fetch(previewUrl, { signal: AbortSignal.timeout(5_000) });
    const body = await res.text();

    if (res.status !== 200) {
      logs.push(`[tester:e2e] GET / returned HTTP ${res.status}`);
      return false;
    }

    if (!body.includes("<html") && !body.includes("<!DOCTYPE")) {
      logs.push("[tester:e2e] Response does not look like a valid HTML page");
      return false;
    }

    logs.push(`[tester:e2e] HTTP 200 OK — valid HTML response received`);
    return true;
  } finally {
    previewProc.kill("SIGTERM");
  }
}

function runCapacitorSync(runDir: string, logs: string[]): boolean {
  const capConfig = path.join(runDir, "capacitor.config.ts");
  const capConfigJs = path.join(runDir, "capacitor.config.js");

  if (!fs.existsSync(capConfig) && !fs.existsSync(capConfigJs)) {
    logs.push(
      "[tester:capacitor] capacitor.config.ts not found — skipping cap sync",
    );
    return true; // not a failure, just not configured
  }

  logs.push("[tester:capacitor] Running npx cap sync...");
  const result = runShell("npx cap sync", runDir, 60_000);
  logs.push(result.output);

  if (!result.success) {
    logs.push("[tester:capacitor] cap sync failed");
    return false;
  }

  logs.push("[tester:capacitor] cap sync succeeded");
  return true;
}

export async function tester(
  runDir: string = "./artifacts",
): Promise<TestResult> {
  const logs: string[] = [];

  // ── 1. package.json 존재 확인 ──────────────────────────────
  const pkgPath = path.join(runDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return { success: false, logs: `package.json not found in ${runDir}` };
  }

  // ── 2. npm install (node_modules 없을 경우) ─────────────────
  const nmPath = path.join(runDir, "node_modules");
  if (!fs.existsSync(nmPath)) {
    logs.push("[tester] Running npm install...");
    const installResult = runShell("npm install --ignore-scripts", runDir);
    logs.push(installResult.output);
    if (!installResult.success) {
      return {
        success: false,
        logs: `npm install failed:\n${logs.join("\n")}`,
      };
    }
  }

  // ── 3. npm run build ─────────────────────────────────────────
  logs.push("[tester] Running npm run build...");
  const buildResult = runShell("npm run build", runDir);
  logs.push(buildResult.output);

  if (!buildResult.success) {
    return { success: false, logs: `build failed:\n${logs.join("\n")}` };
  }

  const hasDist =
    fs.existsSync(path.join(runDir, "dist")) ||
    fs.existsSync(path.join(runDir, "build"));

  if (!hasDist) {
    return {
      success: false,
      logs: `build succeeded but no dist/build directory found in ${runDir}`,
    };
  }

  logs.push("[tester] Build succeeded.");

  // ── 4. Web E2E: vite preview + HTTP 확인 ─────────────────────
  const e2eSuccess = await runWebE2E(runDir, logs);
  if (!e2eSuccess) {
    return { success: false, logs: logs.join("\n") };
  }

  // ── 5. Capacitor sync 검증 ────────────────────────────────────
  const capSuccess = runCapacitorSync(runDir, logs);
  if (!capSuccess) {
    return { success: false, logs: logs.join("\n") };
  }

  return { success: true, logs: logs.join("\n") };
}
