/**
 * Input Resolver — 멀티소스 입력 처리
 *
 * 텍스트 컨셉, 마크다운 파일, 이미지(와이어프레임), PDF, 폴더를
 * Planner가 소비할 수 있는 통합 InputContext로 변환한다.
 */

import fs from "fs";
import path from "path";

// ── 타입 ────────────────────────────────────────────────────────

export interface ImageContent {
  mimeType: string;
  base64: string;
  filePath: string;
}

export interface InputContext {
  /** 입력 유형 */
  type: "text" | "file" | "image" | "folder";
  /** 원본 CLI 인자 (checkpoint 보존용) */
  rawInput: string;
  /** Planner LLM에 전달할 텍스트 컨텍스트 */
  textContent: string;
  /** vision 호출용 이미지 목록 (없으면 빈 배열) */
  images: ImageContent[];
  /** 참조한 파일 경로 목록 (ACP References 기록용) */
  sourceFiles: string[];
}

// ── 상수 ────────────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".html", ".json", ".yaml", ".yml"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const PDF_EXTENSION = ".pdf";

/** Planner에 전달할 텍스트 최대 길이 (토큰 절약) */
const MAX_TEXT_CHARS = 3000;
/** 폴더 스캔 시 수집할 파일 최대 수 */
const MAX_FOLDER_FILES = 5;

// ── 유틸 ────────────────────────────────────────────────────────

function readTextFile(filePath: string): string {
  const raw = fs.readFileSync(filePath, "utf-8");
  if (raw.length <= MAX_TEXT_CHARS) return raw;

  // 초과 시: 마크다운 헤더 기반으로 앞 섹션만 추출
  const lines = raw.split("\n");
  const result: string[] = [];
  let chars = 0;

  for (const line of lines) {
    if (chars + line.length > MAX_TEXT_CHARS) break;
    result.push(line);
    chars += line.length + 1;
  }

  return result.join("\n") + `\n\n...(file truncated at ${MAX_TEXT_CHARS} chars)`;
}

function readImageFile(filePath: string): ImageContent {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  const mimeType = mimeMap[ext] ?? "image/png";
  const base64 = fs.readFileSync(filePath).toString("base64");
  return { mimeType, base64, filePath };
}

async function extractPdfText(filePath: string): Promise<{ text: string; success: boolean }> {
  try {
    // pdf-parse는 선택적 의존성 — 없으면 graceful fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import("pdf-parse")) as any;
    const pdfParse = mod.default ?? mod;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return { text: data.text.slice(0, MAX_TEXT_CHARS), success: true };
  } catch {
    return { text: "", success: false };
  }
}

/** 폴더에서 관련성 높은 파일 우선순위 정렬 후 최대 N개 반환 */
function scanFolder(folderPath: string): string[] {
  const allFiles: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        allFiles.push(fullPath);
      }
    }
  }

  walk(folderPath);

  // 우선순위 점수: 이름 패턴 + 확장자
  const priorityScore = (p: string): number => {
    const base = path.basename(p).toLowerCase();
    let score = 0;
    if (base === "readme.md") score += 10;
    if (/spec|brief|plan|기획|요구|requirement/.test(base)) score += 8;
    if (base.endsWith(".md")) score += 4;
    if (base.endsWith(".txt")) score += 2;
    if (IMAGE_EXTENSIONS.has(path.extname(p).toLowerCase())) score += 1;
    return score;
  };

  return allFiles
    .filter((p) => {
      const ext = path.extname(p).toLowerCase();
      return TEXT_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext) || ext === PDF_EXTENSION;
    })
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, MAX_FOLDER_FILES);
}

// ── 메인 API ──────────────────────────────────────────────────

/**
 * CLI 인자를 받아 InputContext로 변환한다.
 *
 * 판별 순서:
 * 1. 존재하는 디렉토리 → folder 처리
 * 2. 존재하는 파일 → 확장자에 따라 text / image / pdf 처리
 * 3. 그 외 → 텍스트 컨셉으로 처리
 */
export async function resolveInput(rawInput: string): Promise<InputContext> {
  const trimmed = rawInput.trim();

  // ── 폴더 ──────────────────────────────────────────────────
  if (fs.existsSync(trimmed) && fs.statSync(trimmed).isDirectory()) {
    console.log(`[input] Folder detected: ${trimmed}`);
    const files = scanFolder(trimmed);
    console.log(`[input] Collected ${files.length} files from folder.`);

    const texts: string[] = [`# Input from folder: ${path.basename(trimmed)}\n`];
    const images: ImageContent[] = [];
    const sourceFiles: string[] = [];

    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      const relPath = path.relative(process.cwd(), filePath);

      if (IMAGE_EXTENSIONS.has(ext)) {
        images.push(readImageFile(filePath));
        sourceFiles.push(relPath);
        console.log(`[input]   📷 ${relPath}`);
      } else if (ext === PDF_EXTENSION) {
        const { text, success } = await extractPdfText(filePath);
        if (success) {
          texts.push(`## ${path.basename(filePath)}\n\n${text}`);
          sourceFiles.push(relPath);
          console.log(`[input]   📄 ${relPath} (PDF text extracted)`);
        } else {
          console.warn(`[input]   ⚠️  ${relPath} (PDF parse failed, skipped)`);
        }
      } else {
        const text = readTextFile(filePath);
        texts.push(`## ${path.basename(filePath)}\n\n${text}`);
        sourceFiles.push(relPath);
        console.log(`[input]   📝 ${relPath}`);
      }
    }

    return {
      type: "folder",
      rawInput: trimmed,
      textContent: texts.join("\n\n---\n\n"),
      images,
      sourceFiles,
    };
  }

  // ── 파일 ──────────────────────────────────────────────────
  if (fs.existsSync(trimmed) && fs.statSync(trimmed).isFile()) {
    const ext = path.extname(trimmed).toLowerCase();
    const relPath = path.relative(process.cwd(), trimmed);

    // 이미지
    if (IMAGE_EXTENSIONS.has(ext)) {
      console.log(`[input] Image file detected: ${relPath}`);
      const image = readImageFile(trimmed);
      return {
        type: "image",
        rawInput: trimmed,
        textContent: `Wireframe/mockup image provided: ${path.basename(trimmed)}`,
        images: [image],
        sourceFiles: [relPath],
      };
    }

    // PDF
    if (ext === PDF_EXTENSION) {
      console.log(`[input] PDF file detected: ${relPath}`);
      const { text, success } = await extractPdfText(trimmed);
      if (success) {
        return {
          type: "file",
          rawInput: trimmed,
          textContent: text,
          images: [],
          sourceFiles: [relPath],
        };
      }
      // PDF 파싱 실패 시 이미지로 fallback — 첫 페이지를 vision에 넘길 수 없으므로 경고 후 path만 기록
      console.warn(`[input] PDF parse failed. Treating as text placeholder.`);
      return {
        type: "file",
        rawInput: trimmed,
        textContent: `PDF file provided: ${path.basename(trimmed)} (text extraction failed; describe the app concept manually if possible)`,
        images: [],
        sourceFiles: [relPath],
      };
    }

    // 텍스트 파일
    if (TEXT_EXTENSIONS.has(ext)) {
      console.log(`[input] Text file detected: ${relPath}`);
      const text = readTextFile(trimmed);
      return {
        type: "file",
        rawInput: trimmed,
        textContent: text,
        images: [],
        sourceFiles: [relPath],
      };
    }
  }

  // ── 텍스트 컨셉 (기본) ────────────────────────────────────
  return {
    type: "text",
    rawInput: trimmed,
    textContent: trimmed,
    images: [],
    sourceFiles: [],
  };
}
