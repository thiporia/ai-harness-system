/**
 * Agent Communication Protocol (ACP) v1
 * docs/AGENT_COMMS_PROTOCOL.md 스펙 구현체
 *
 * 에이전트 간 모든 소통은 이 모듈을 통해 .md 파일로 기록된다.
 *
 * ── 크기 제어 원칙 ──────────────────────────────────────────────
 * LLM 출력 크기는 각 프롬프트에서 직접 명시하여 처음부터 최적 크기로 생성한다.
 * 생성 후 절단(truncate)은 프롬프트 버그를 감지하는 안전망으로만 사용한다.
 * enforceSummaryBudget()이 경고를 출력하면 해당 프롬프트의 크기 제한을 강화해야 한다.
 */

import fs from "fs";
import path from "path";

// ── 상수 ────────────────────────────────────────────────────────
export const ACP_SUMMARY_MAX = 800;
export const ACP_DETAILS_MAX = 2000;
const ACP_BASE_DIR = "./docs/agent-comms";
const ACP_VERSION = 1;

// ── 타입 ────────────────────────────────────────────────────────
export type AcpAgentName = "planner" | "designer" | "developer" | "tester" | "reviewer" | "orchestrator";
export type AcpType = "output" | "review" | "feedback";
export type AcpStatus = "approved" | "rejected" | "success" | "failure" | "info";

export interface AcpFrontmatter {
  from: AcpAgentName;
  to: AcpAgentName | "orchestrator";
  type: AcpType;
  run_id: string;
  attempt: number;
  status: AcpStatus;
}

export interface AcpFileData {
  frontmatter: AcpFrontmatter;
  summary: string;      // ≤800자
  details?: string;     // ≤2,000자 (선택)
  references?: string[]; // 원본 파일 경로 목록
}

// ── 경로 헬퍼 ───────────────────────────────────────────────────
export function acpFilePath(runId: string, filename: string): string {
  return path.join(ACP_BASE_DIR, runId, filename);
}

function acpDir(runId: string): string {
  return path.join(ACP_BASE_DIR, runId);
}

// ── 크기 제한 유틸 ───────────────────────────────────────────────

/**
 * 안전망: LLM이 프롬프트에 명시된 글자 수를 지켰는지 확인한다.
 * 초과 시 경고만 출력하고 원본을 그대로 반환한다.
 * (절단하면 맥락이 끊겨 다음 LLM 추론이 실패하므로 절단하지 않는다.)
 *
 * 이 함수가 경고를 출력하면 해당 LLM 프롬프트의 글자 수 제한을 강화해야 한다.
 */
export function enforceSummaryBudget(text: string, max = ACP_SUMMARY_MAX): string {
  const t = text.trim();
  if (t.length > max) {
    console.warn(
      `[ACP] ⚠️  Output exceeded budget: ${t.length}/${max} chars. ` +
      `Tighten the char limit in the corresponding LLM prompt.`
    );
  }
  return t;
}

/**
 * 보관용 절단: ACP Details 섹션처럼 LLM에 전달되지 않는 아카이브 필드에만 사용한다.
 * LLM 입력이 될 Summary에는 enforceSummaryBudget()을 사용할 것.
 */
export function truncateForArchive(text: string, max = ACP_DETAILS_MAX): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + "\n...(archived content truncated)";
}

/**
 * 빌드/테스트 로그에서 핵심 에러 3줄만 추출
 * (에러는 하단에 집중되므로 마지막 부분을 역방향으로 스캔)
 */
export function extractBuildError(logs: string): string {
  const lines = logs.split("\n").map((l) => l.trim()).filter(Boolean);
  const errorLines: string[] = [];

  // error/Error/ERROR 포함 라인 우선 수집
  for (let i = lines.length - 1; i >= 0 && errorLines.length < 3; i--) {
    const l = lines[i];
    if (l && /error|Error|ERROR|failed|FAILED|✗|×/.test(l)) {
      errorLines.unshift(l);
    }
  }

  // 에러 라인이 없으면 마지막 3줄 반환
  if (errorLines.length === 0) {
    return lines.slice(-3).join("\n");
  }

  return errorLines.slice(0, 3).join("\n");
}

// ── ACP 파일 작성 ────────────────────────────────────────────────
export function writeAcpFile(
  runId: string,
  filename: string,
  data: AcpFileData
): string {
  const dir = acpDir(runId);
  fs.mkdirSync(dir, { recursive: true });

  // summary: LLM이 프롬프트 지시에 따라 이미 적합한 길이로 생성해야 함.
  // 초과 시 경고만 출력하고 원본 유지 (절단하면 다음 LLM 추론이 실패).
  const summary = enforceSummaryBudget(data.summary, ACP_SUMMARY_MAX);
  // details: 아카이브 전용, LLM 입력 아님 → 길면 절단 허용
  const details = data.details
    ? truncateForArchive(data.details, ACP_DETAILS_MAX)
    : undefined;

  const frontmatter = [
    "---",
    `acp_version: ${ACP_VERSION}`,
    `from: ${data.frontmatter.from}`,
    `to: ${data.frontmatter.to}`,
    `type: ${data.frontmatter.type}`,
    `run_id: ${data.frontmatter.run_id}`,
    `attempt: ${data.frontmatter.attempt}`,
    `timestamp: ${new Date().toISOString()}`,
    `status: ${data.frontmatter.status}`,
    "---",
  ].join("\n");

  const sections: string[] = [
    frontmatter,
    "",
    "## Summary",
    "",
    summary,
  ];

  if (details) {
    sections.push("", "## Details", "", details);
  }

  if (data.references && data.references.length > 0) {
    sections.push(
      "",
      "## References",
      "",
      ...data.references.map((r) => `- ${r}`)
    );
  }

  const content = sections.join("\n");
  const filePath = acpFilePath(runId, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ── ACP 파일 읽기 ────────────────────────────────────────────────
/**
 * ACP 파일에서 Summary 섹션만 읽어 반환 (LLM에 전달할 용도)
 * 파일 전체를 읽지 않아 토큰 절약
 */
export function readAcpSummary(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  const raw = fs.readFileSync(filePath, "utf-8");

  const summaryMatch = raw.match(/^## Summary\s*\n+([\s\S]*?)(?=\n## |\s*$)/m);
  if (!summaryMatch) return "";
  // 읽기 시 경고 없이 반환 (이미 저장 시점에 enforceSummaryBudget이 검증함)
  return summaryMatch[1]?.trim() ?? "";
}

/**
 * ACP 파일 전체 내용 반환 (감사 추적용, LLM 직접 전달 금지)
 */
export function readAcpFull(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

// ── Summary 빌더 헬퍼 ────────────────────────────────────────────

/**
 * Plan 객체 → ACP Summary 문자열
 */
export function buildPlanSummary(plan: {
  features?: Array<{ name?: string; description?: string }>;
  stack_decision?: { selected?: string[] };
  device_targets?: string[];
}): string {
  const features = (plan.features ?? [])
    .map((f, i) => `${i + 1}. ${f?.name ?? JSON.stringify(f)}`)
    .join("\n");

  const stack = (plan.stack_decision?.selected ?? []).join(", ") || "미정";
  const targets = (plan.device_targets ?? []).join(", ") || "미정";

  return enforceSummaryBudget(
    `Stack: ${stack}\nTargets: ${targets}\n\nFeatures:\n${features}`
  );
}

/**
 * Design 객체 → ACP Summary 문자열
 */
export function buildDesignSummary(design: {
  components?: Array<{ name?: string; description?: string }>;
  design_references_used?: string[];
}): string {
  const comps = (design.components ?? [])
    .map((c) => `- ${c?.name ?? "unnamed"}${c?.description ? `: ${c.description}` : ""}`)
    .join("\n");

  const refs = (design.design_references_used ?? []).join(", ") || "없음";

  return enforceSummaryBudget(
    `Components (${design.components?.length ?? 0}):\n${comps}\n\nDesign refs: ${refs}`
  );
}

/**
 * Developer 결과 → ACP Summary 문자열
 */
export function buildDeveloperSummary(
  files: string[],
  npmSuccess: boolean,
  gitSuccess: boolean
): string {
  const fileList = files.slice(0, 20).map((f) => `- ${f}`).join("\n");
  const extra = files.length > 20 ? `\n...(+${files.length - 20} more)` : "";
  return enforceSummaryBudget(
    `npm install: ${npmSuccess ? "✅" : "❌"} | git init: ${gitSuccess ? "✅" : "❌"}\n` +
    `Files (${files.length}):\n${fileList}${extra}`
  );
}

/**
 * Tester 결과 → ACP Summary 문자열
 */
export function buildTesterSummary(success: boolean, logs: string): string {
  const status = success ? "✅ PASS" : "❌ FAIL";
  const errorSnippet = success ? "" : `\n\nError:\n${extractBuildError(logs)}`;
  return enforceSummaryBudget(`Build/E2E: ${status}${errorSnippet}`);
}

/**
 * Review 결과 → ACP Summary 문자열
 */
export function buildReviewSummary(approved: boolean, feedback: string): string {
  const status = approved ? "✅ APPROVED" : "❌ REJECTED";
  return enforceSummaryBudget(`${status}\n${feedback}`);
}
