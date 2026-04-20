/**
 * Checkpoint — 단계별 진행 상태 저장/복원
 *
 * 중단된 실행을 재개할 때 이미 완료된 단계를 건너뛴다.
 * Checkpoint 파일 위치: artifacts/<run-id>/checkpoint.json
 */

import fs from "fs";
import path from "path";

// ── 타입 ────────────────────────────────────────────────────────

export type CompletedStage =
  | "none"
  | "planner"
  | "designer"
  | "developer"
  | "done";

export interface Checkpoint {
  run_id: string;
  input: string;
  completed_stage: CompletedStage;
  developer_attempt: number;
  plan: unknown | null;
  design: unknown | null;
  feedback: string;
  saved_at: string;
}

// ── 경로 헬퍼 ───────────────────────────────────────────────────

const ARTIFACTS_DIR = "./artifacts";

function checkpointPath(runDir: string): string {
  return path.join(runDir, "checkpoint.json");
}

// ── 저장 ────────────────────────────────────────────────────────

export function saveCheckpoint(
  runDir: string,
  data: Omit<Checkpoint, "saved_at">,
): void {
  const checkpoint: Checkpoint = {
    ...data,
    saved_at: new Date().toISOString(),
  };
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(
    checkpointPath(runDir),
    JSON.stringify(checkpoint, null, 2),
    "utf-8",
  );
}

// ── 로드 ────────────────────────────────────────────────────────

export function loadCheckpoint(runDir: string): Checkpoint | null {
  const p = checkpointPath(runDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as Checkpoint;
  } catch {
    return null;
  }
}

// ── 미완료 run 탐색 ──────────────────────────────────────────────

/**
 * artifacts/ 아래 run-id 폴더를 최신순으로 스캔해
 * completed_stage가 "done"이 아닌 첫 번째 run-id를 반환한다.
 */
export function findLatestIncompleteRun(): {
  runId: string;
  checkpoint: Checkpoint;
} | null {
  if (!fs.existsSync(ARTIFACTS_DIR)) return null;

  const entries = fs
    .readdirSync(ARTIFACTS_DIR)
    .filter((name) => name !== "latest")
    .sort()
    .reverse(); // 최신순

  for (const name of entries) {
    const runDir = path.join(ARTIFACTS_DIR, name);
    const checkpoint = loadCheckpoint(runDir);
    if (checkpoint && checkpoint.completed_stage !== "done") {
      return { runId: name, checkpoint };
    }
  }

  return null;
}

// ── CLI 인자 파싱 ────────────────────────────────────────────────

export interface RunTarget {
  runId: string | null; // null이면 새 실행
  resume: boolean;
  input: string;
  checkpoint: Checkpoint | null;
}

/**
 * process.argv를 파싱해 실행 대상을 결정한다.
 *
 * 패턴:
 *   node dist/orchestrator.js "앱 컨셉"               → 새 실행
 *   node dist/orchestrator.js --resume                → 최신 미완료 run 재개
 *   node dist/orchestrator.js --resume <run-id>       → 특정 run 재개
 */
export function resolveRunTarget(
  argv: string[],
  defaultInput: string,
): RunTarget {
  const args = argv.slice(2); // node + script 제거
  const resumeIdx = args.indexOf("--resume");

  if (resumeIdx === -1) {
    // 새 실행
    return {
      runId: null,
      resume: false,
      input: args[0] ?? defaultInput,
      checkpoint: null,
    };
  }

  // --resume 모드
  const explicitRunId = args[resumeIdx + 1];
  const isRunId = explicitRunId && !explicitRunId.startsWith("--");

  if (isRunId) {
    // 특정 run-id 지정
    const runDir = path.join(ARTIFACTS_DIR, explicitRunId);
    const checkpoint = loadCheckpoint(runDir);
    if (!checkpoint) {
      console.error(
        `[resume] No checkpoint found for run-id: ${explicitRunId}`,
      );
      process.exit(1);
    }
    console.log(
      `[resume] Resuming run: ${explicitRunId} (stage: ${checkpoint.completed_stage})`,
    );
    return {
      runId: explicitRunId,
      resume: true,
      input: checkpoint.input,
      checkpoint,
    };
  }

  // 최신 미완료 run 자동 탐색
  const found = findLatestIncompleteRun();
  if (!found) {
    console.error("[resume] No incomplete run found. Starting a new run.");
    return {
      runId: null,
      resume: false,
      input: defaultInput,
      checkpoint: null,
    };
  }

  console.log(
    `[resume] Resuming latest incomplete run: ${found.runId} (stage: ${found.checkpoint.completed_stage})`,
  );
  return {
    runId: found.runId,
    resume: true,
    input: found.checkpoint.input,
    checkpoint: found.checkpoint,
  };
}
