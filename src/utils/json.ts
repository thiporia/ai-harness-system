/**
 * 괄호 균형 기반으로 첫 번째 완결된 JSON 객체/배열을 추출한다.
 * 탐욕적 정규식의 오매칭 문제를 방지한다.
 */
function extractBalancedJson(text: string): string | null {
  const startIdx = text.search(/[{[]/);
  if (startIdx === -1) return null;

  const open = text[startIdx]!;
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i]!;

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === open || (open === "{" ? ch === "[" : ch === "{")) {
      // 중첩 열기: { 또는 [ 모두 depth 증가
      if (ch === "{" || ch === "[") depth++;
    }
    if (ch === "}" || ch === "]") {
      depth--;
    }

    if (depth === 0) {
      return text.slice(startIdx, i + 1);
    }
  }

  return null; // 균형이 맞지 않음
}

export function parseJsonResponse<T>(raw: string): T {
  const trimmed = raw.trim();

  // 마크다운 펜스 제거
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ? fenced[1].trim() : trimmed;

  // 1차 시도: 전체 candidate를 그대로 파싱
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // 2차 시도: 괄호 균형 기반 JSON 추출
    const extracted = extractBalancedJson(candidate);
    if (!extracted) {
      throw new Error(
        `[parseJsonResponse] LLM did not return parseable JSON. ` +
        `Preview: ${trimmed.slice(0, 120)}`
      );
    }
    try {
      return JSON.parse(extracted) as T;
    } catch (e2) {
      throw new Error(
        `[parseJsonResponse] Extracted JSON is still invalid. ` +
        `Error: ${(e2 as Error).message}. ` +
        `Extracted preview: ${extracted.slice(0, 120)}`
      );
    }
  }
}
