import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface TestResult {
  success: boolean;
  logs: string;
}

function runShell(cmd: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd, stdio: "pipe", timeout: 180_000 }).toString();
    return { success: true, output };
  } catch (err: any) {
    const stderr = err?.stderr?.toString() ?? "";
    const stdout = err?.stdout?.toString() ?? "";
    return { success: false, output: [stdout, stderr].filter(Boolean).join("\n") };
  }
}

export async function tester(runDir: string = "./artifacts"): Promise<TestResult> {
  const logs: string[] = [];

  // 1. package.json 존재 확인
  const pkgPath = path.join(runDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return { success: false, logs: `package.json not found in ${runDir}` };
  }

  // 2. node_modules 없으면 npm install
  const nmPath = path.join(runDir, "node_modules");
  if (!fs.existsSync(nmPath)) {
    logs.push("[tester] Running npm install...");
    const installResult = runShell("npm install --prefer-offline", runDir);
    logs.push(installResult.output);
    if (!installResult.success) {
      return { success: false, logs: `npm install failed:\n${logs.join("\n")}` };
    }
  }

  // 3. npm run build 실행
  logs.push("[tester] Running npm run build...");
  const buildResult = runShell("npm run build", runDir);
  logs.push(buildResult.output);

  if (!buildResult.success) {
    return { success: false, logs: `build failed:\n${logs.join("\n")}` };
  }

  // 4. 빌드 산출물 존재 확인 (dist/ 또는 build/)
  const hasDist =
    fs.existsSync(path.join(runDir, "dist")) ||
    fs.existsSync(path.join(runDir, "build"));

  if (!hasDist) {
    return {
      success: false,
      logs: `build succeeded but no dist/build directory found in ${runDir}`
    };
  }

  logs.push("[tester] Build succeeded. dist/build directory found.");
  return { success: true, logs: logs.join("\n") };
}
