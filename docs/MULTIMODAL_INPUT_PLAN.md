# 멀티모달 입력 소스 구현 계획

## 개념

현재 Planner는 짧은 텍스트 컨셉만 받는다.
목표는 아래 형태의 입력을 모두 받아 Planner 컨텍스트로 변환하는 것이다.

| 입력 형태 | 예시 |
|----------|------|
| 텍스트 컨셉 | `"가족과 함께 쓰는 식단 관리 앱"` |
| 마크다운/텍스트 파일 | `./docs/spec.md`, `./planning.txt` |
| 이미지 (와이어프레임, 캡처) | `./wireframe.png`, `./mockup.jpg` |
| PDF 기획서 | `./planning.pdf` |
| 폴더 (문서 묶음) | `./project-brief/` |

---

## 처리 전략

### 텍스트 파일 (.md, .txt, .html)
- 파일 전체 읽기 → 3,000자 이내면 그대로 사용
- 초과 시 앞부분 + 핵심 섹션(헤더 기반) 추출

### 이미지 (.png, .jpg, .jpeg, .webp)
- Base64 인코딩 → LLM vision API로 전달
- OpenAI: `content: [{ type: "image_url", ... }]`
- Gemini: `parts: [{ inlineData: { mimeType, data } }]`

### PDF (.pdf)
- 텍스트 추출 시도 (`pdf-parse` 라이브러리)
- 실패 시 이미지로 변환해 vision 전달 (1페이지만)

### 폴더
- 하위 파일 스캔 → 관련성 높은 파일 우선 선택
  - 우선순위: README.md > SPEC.md > 기타 .md > .txt > 이미지
  - 최대 5개 파일 수집
- 각 파일을 개별 처리 후 컨텍스트 병합

---

## 신규 파일

### `src/utils/input-resolver.ts`

```typescript
export interface InputContext {
  type: "text" | "file" | "image" | "folder";
  rawInput: string;        // 원본 인자
  textContent: string;     // 텍스트 컨텍스트 (Planner 프롬프트용)
  images: ImageContent[];  // 이미지 (vision 호출용)
  sourceFiles: string[];   // 참조한 파일 경로 목록
}

export interface ImageContent {
  mimeType: string;
  base64: string;
  filePath: string;
}

export async function resolveInput(rawInput: string): Promise<InputContext>
```

### `src/utils/openai.ts` 수정

- `callLLM(system, user)` 유지
- `callLLMWithVision(system, user, images)` 추가

---

## 수정 파일

### `src/agents/planner.ts`

- `planner(input: string)` → `planner(ctx: InputContext)`
- Decompose 호출 시 텍스트 컨텍스트 + 이미지 함께 전달

### `src/utils/checkpoint.ts`

- `Checkpoint.input` → `Checkpoint.rawInput: string` (경로 또는 텍스트 보존)

### `src/orchestrator.ts`

- `resolveInput(target.input)` → `InputContext` 획득
- Planner에 `InputContext` 전달

---

## CLI 변경

```bash
# 텍스트 컨셉 (기존)
npm run start "가족 식단 관리 앱"

# 파일
npm run start ./docs/brief.md
npm run start ./wireframe.png

# 폴더
npm run start ./project-brief/
```

입력이 존재하는 경로인지 먼저 확인 → 경로면 파일/폴더 처리, 아니면 텍스트로 처리
