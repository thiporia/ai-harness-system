# AI Harness System — 사용 가이드

> 이 문서는 AI Harness System을 처음 접하는 개발자를 위한 종합 안내서입니다.

---

## 목차

1. [이 시스템이 하는 일](#1-이-시스템이-하는-일)
2. [사전 요구사항](#2-사전-요구사항)
3. [설치 및 설정](#3-설치-및-설정)
4. [실행 방법](#4-실행-방법)
5. [Agent 상세](#5-agent-상세)
6. [ACP — Agent 간 소통 방식](#6-acp--agent-간-소통-방식)
7. [산출물 읽는 법](#7-산출물-읽는-법)
8. [Harness 커스터마이징](#8-harness-커스터마이징)
9. [비용 산정](#9-비용-산정)
10. [트러블슈팅](#10-트러블슈팅)

---

## 1. 이 시스템이 하는 일

AI Harness System은 **"컨셉 텍스트 한 줄"로 완성된 React + TypeScript + Vite + Capacitor 프로젝트를 자동 생성**합니다.

```bash
npm run start "운동 루틴을 기록하고 주간 통계를 보여주는 앱"
```

실행 결과로 `artifacts/<run-id>/` 아래에 즉시 실행 가능한 프로젝트가 생성됩니다.

```bash
cd artifacts/<run-id>
npm run dev    # → http://localhost:5173
npm run build  # → dist/ 프로덕션 빌드
```

### 내부에서 일어나는 일

단계별로 5개의 AI Agent가 협업합니다.

```
[1] Planner   → 컨셉을 feature 목록으로 분해 → feature당 상세 계획 수립
[2] Designer  → component 목록 도출 → component당 설계 (awesome-design-md 참조)
[3] Developer → 생성할 파일 목록 도출 → 파일당 코드 생성
[4] Tester    → 빌드 + E2E + Capacitor sync 검증
[5] Reviewer  → 모든 단계에서 품질 검토, 미통과 시 재시도 요청
```

각 단계는 **Reviewer의 검토**를 거칩니다. 최대 5회까지 자동으로 수정 후 재시도합니다.

---

## 2. 사전 요구사항

| 항목 | 조건 |
|------|------|
| Node.js | 18 이상 |
| npm | 8 이상 |
| Git | 설치 필요 (Developer Agent가 초기 커밋 생성) |
| LLM API 키 | OpenAI 또는 Google Gemini 중 하나 |

> Capacitor 네이티브 빌드(iOS/Android 실기기 설치)는 Xcode/Android Studio가 필요합니다. 없어도 Web 빌드 및 `cap sync`까지는 정상 동작합니다.

---

## 3. 설치 및 설정

### 3-1. 설치

```bash
git clone https://github.com/thiporia/ai-harness-system.git
cd ai-harness-system
npm install
```

### 3-2. 환경 변수

프로젝트 루트에 `.env` 파일을 생성합니다.

```dotenv
# LLM 공급자 선택 ("openai" 또는 "gemini", 기본값: openai)
LLM_PROVIDER=openai

# OpenAI 설정
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Gemini 설정
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
```

**모델 선택 가이드**

| 상황 | 권장 |
|------|------|
| 빠른 테스트 / 비용 절감 | `gpt-4o-mini` 또는 `gemini-2.5-flash` |
| 복잡한 앱 / 높은 품질 | `gpt-4o` |

### 3-3. 빌드

```bash
npm run build
# → dist/ 생성
```

---

## 4. 실행 방법

### 기본 실행

```bash
npm run start "<앱 컨셉>"
```

컨셉은 한국어/영어 모두 가능합니다. 구체적일수록 더 정확한 결과가 나옵니다.

```bash
npm run start "가족이 함께 쓰는 장보기 목록 앱"
npm run start "팀원들과 일정을 공유하는 캘린더 앱"
npm run start "React Todo App with CRUD and local storage"
```

컨셉을 생략하면 기본값 `React Todo App with CRUD`로 실행됩니다.

### 실행 중 콘솔 출력

```
============================================================
[run: 2026-04-15T09-00-00-000Z]
Input: "가족이 함께 쓰는 장보기 목록 앱"
Output: ./artifacts/2026-04-15T09-00-00-000Z
ACP: docs/agent-comms/2026-04-15T09-00-00-000Z/
============================================================

[1/5] Planning...
  [planner] Decomposing features...
  [planner] Planning 6 features individually...
  [planner] Feature 1/6: "장보기 항목 CRUD"
  [planner] Feature 2/6: "카테고리 관리"
  ...
  → ACP: docs/agent-comms/.../01-planner-output.md
  → reviewPlan (1/5)
  → ACP: docs/agent-comms/.../02-plan-review-1.md
  ✅ Plan approved.

[2/5] Designing (with awesome-design-md refs)...
  [designer] Loaded design ref: todo-list.md
  [designer] Designing 8 components individually...
  [designer] Component 1/8: "ShoppingListItem"
  ...
  → reviewDesign (1/5)
  ✅ Design approved.

[3-4/5] Developing + Testing...

  ── Attempt 1/5 ──
  [developer] Decomposing file manifest...
  [developer] 18 files to generate.
  [developer] [1/18] package.json
  [developer] [2/18] vite.config.ts
  ...
  [developer] [18/18] src/features/cart/CartSummary.tsx
  → ACP: docs/agent-comms/.../05-developer-attempt-1.md
  [Phase 2] Build + E2E + cap sync...
  ✅ Build passed
  [Phase 3] Semantic review (Planner + Designer, parallel)...
  ✅ All phases passed.

[5/5] Quality Gate...
✅ Orchestration complete.

Build report → ./artifacts/2026-04-15T09-00-00-000Z/BUILD_REPORT.md
Latest       → ./artifacts/latest
ACP records  → docs/agent-comms/2026-04-15T09-00-00-000Z/
```

### 생성된 프로젝트 실행

```bash
cd artifacts/<run-id>
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

---

## 5. Agent 상세

### Planner

컨셉을 구조화된 기획으로 변환합니다.

**동작 방식 (Task 분해)**

1. Decompose: 컨셉 → feature 이름 목록 (LLM 1회, ≤2,000 토큰 입력)
2. Execute: feature당 `description` + `acceptance_tests` 생성 (LLM N회 병렬)
3. Aggregate: 결과를 Plan JSON으로 조합 (LLM 호출 없음)

**출력 예시**

```json
{
  "scope": {
    "in_scope": ["장보기 항목 CRUD", "카테고리 분류"],
    "out_of_scope": ["결제", "배달 연동"]
  },
  "device_targets": ["mobile", "web"],
  "stack_decision": {
    "fixed": ["React", "TypeScript", "Capacitor"],
    "selected": ["Jotai"],
    "rationale": ["상태 복잡도 낮음"]
  },
  "folder_plan": ["src/app", "src/features", "src/components", "src/hooks", "src/types"],
  "features": [
    { "name": "장보기 항목 CRUD", "description": "항목 추가/수정/삭제/체크 기능", "acceptance_tests": [...] }
  ]
}
```

**검토**: `reviewPlan`이 scope, stack, acceptance_tests 기준으로 심사. 미통과 시 피드백과 함께 최대 5회 재기획.

---

### Designer

Plan의 feature 목록에서 필요한 React 컴포넌트를 설계합니다. [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 레포에서 feature 키워드에 맞는 디자인 레퍼런스(최대 3개)를 자동 참조합니다.

**동작 방식 (Task 분해)**

1. 병렬 실행: awesome-design-md fetch + component 이름 목록 Decompose (LLM 1회)
2. Execute: component당 props, design_notes 설계 (LLM N회 순차)
3. Aggregate: 최종 Design JSON 조합

**출력 예시**

```json
{
  "components": [
    {
      "name": "ShoppingListItem",
      "description": "개별 장보기 항목을 카드 형태로 렌더링",
      "props": ["id: string", "name: string", "checked: boolean", "onToggle: () => void"],
      "design_notes": "스와이프 삭제 패턴, 체크 시 취소선 적용"
    }
  ],
  "design_references_used": ["todo-list.md", "form-design.md"]
}
```

**검토**: `reviewDesign`이 feature-component 매핑 정합성 검사. 최대 5회 재설계.

---

### Developer

Plan + Design을 바탕으로 실제 동작하는 멀티파일 프로젝트를 생성합니다.

**동작 방식 (Task 분해 — 핵심)**

기존의 "파일 전체를 한 번에 요청하는 방식"을 완전히 폐기하고, 파일당 독립 LLM 호출로 전환합니다.

1. Decompose: Plan + Design → `FileSpec[]` (파일 경로 + 목적 + exports 목록만, 코드 없음)
2. Execute: 파일당 LLM 1회 호출, 생성 즉시 디스크에 저장
   - 다른 파일 전체 코드는 전달하지 않음 — **이미 생성된 파일의 exports 시그니처만** 컨텍스트로 공유
   - 한 파일 실패해도 나머지 파일 계속 진행
3. Post: `npm install` + `git init` + 초기 커밋

**컨텍스트 공유 방식**

```
"이미 생성된 파일:
- src/types/index.ts → exports: Todo, Category
- src/hooks/useTodos.ts → exports: useTodos

지금 생성할 파일: src/components/TodoList.tsx
목적: Todo 목록 렌더링 및 완료/삭제 버튼 제공"
```

---

### Tester

생성된 프로젝트를 실제로 빌드하고 동작 여부를 검증합니다.

**검증 파이프라인**

1. `package.json` 존재 확인
2. `node_modules` 없으면 `npm install`
3. `npm run build` 실행 → `dist/` 생성 확인
4. `vite preview` 서버 기동 → HTTP 200 + HTML 응답 확인 (30초 타임아웃)
5. `capacitor.config.ts` 존재 시 `npx cap sync` 실행

실패 시 Reviewer에게 에러 요약(핵심 3줄)을 전달하고 Developer 재시도를 요청합니다.

---

### Reviewer

모든 단계에서 품질 검토를 담당합니다.

| 함수 | 검토 대상 | 기준 |
|------|----------|------|
| `reviewPlan` | Planner 결과 | scope, stack, acceptance_tests 충족도 |
| `reviewDesign` | Designer 결과 | feature-component 매핑 완성도 |
| `reviewer` | 빌드 에러 로그 | 에러 원인 + 수정 방향 (각 ≤80자) |
| `reviewCodeVsPlan` | 생성된 코드 vs Plan | feature 구현 여부 (키워드 매칭) |
| `reviewCodeVsDesign` | 생성된 코드 vs Design | component 존재 여부 |

Reviewer는 전체 JSON 대신 **핵심 필드 요약만** 전달받아 검토합니다. 빌드 로그도 전체를 받지 않고 에러 핵심 3줄만 받습니다.

---

## 6. ACP — Agent 간 소통 방식

Agent 간 데이터 교환은 직접 JSON 객체를 넘기지 않습니다. **`.md` 파일(ACP 파일)을 매개**로 합니다.

### ACP 파일 구조

```markdown
---
acp_version: 1
from: planner
to: orchestrator
type: output
run_id: 2026-04-15T09-00-00-000Z
attempt: 1
timestamp: 2026-04-15T09:00:05.000Z
status: info
---

## Summary
Stack: Jotai
Targets: mobile, web

Features:
1. 장보기 항목 CRUD
2. 카테고리 관리
...

## References
- docs/artifacts/history/2026-04-15T09-00-00-000Z-plan.md
```

### 핵심 규칙

- **LLM에는 Summary만 전달** — 전체 JSON, 전체 코드, 전체 로그는 LLM에 전달하지 않음
- **원본은 References 경로로 보관** — 아카이브는 별도 파일에 저장
- **파일당 1번 생성, 덮어쓰기 없음** — 시도마다 새 번호로 생성 (`-N.md`)

### 파일 위치

```
docs/agent-comms/<run-id>/
  01-planner-output.md
  02-plan-review-1.md          ← Reviewer → Planner
  02-plan-review-2.md          ← 재시도 시 추가
  03-designer-output.md
  04-design-review-1.md
  05-developer-attempt-1.md
  06-tester-result-1.md
  07-build-review-1.md         ← Reviewer → Developer (빌드 실패 시)
  08-semantic-review-1.md      ← Planner + Designer → Developer
```

---

## 7. 산출물 읽는 법

### BUILD_REPORT.md

실행 후 가장 먼저 볼 파일입니다. 전 과정의 요약이 담겨 있습니다.

```
artifacts/<run-id>/BUILD_REPORT.md
artifacts/latest/BUILD_REPORT.md   ← 최신 실행 결과 빠른 확인
```

**주요 항목**

| 섹션 | 내용 |
|------|------|
| 메타데이터 | run_id, 생성 시각, 입력 컨셉, ACP 디렉토리 경로 |
| Planner 요약 | feature 목록, Reviewer 검토 횟수 |
| Designer 요약 | component 목록, 참조한 디자인 레퍼런스 |
| Developer 이력 | 총 시도 횟수, 각 시도별 Reviewer 피드백, ACP 파일 참조 |
| Quality Gate | 빌드/E2E 결과 |
| 최종 상태 | ✅ 성공 / ⚠️ 부분 완료 / ❌ 실패 + 사유 |

### ACP 통신 기록

Agent 간 실제 소통 내용을 추적할 수 있습니다.

```bash
# 특정 실행의 전체 ACP 기록 확인
ls docs/agent-comms/<run-id>/

# 예: Reviewer가 Developer에게 전달한 빌드 피드백
cat docs/agent-comms/<run-id>/07-build-review-1.md
```

### 빌드 로그

```bash
artifacts/<run-id>/build-1.log   ← 시도 1의 전체 빌드 로그
artifacts/<run-id>/build-2.log   ← 시도 2의 전체 빌드 로그
```

---

## 8. Harness 커스터마이징

### 기본 스택 변경

`docs/HARNESS_SPEC.md`의 Core Stack Baseline 섹션을 수정합니다.

```markdown
## Core Stack Baseline

- UI Framework: React
- Language: TypeScript
- 상태 저장소: Jotai  ← 변경 가능
- 서버 데이터: Supabase  ← 변경 가능
```

수정 후에는 `src/utils/harness-context.ts`를 통해 모든 Agent LLM 호출에 주입됩니다.

### Reviewer 기준 조정

`src/agents/reviewer.ts`에서 각 검토 함수의 평가 기준을 조정할 수 있습니다.

```typescript
// reviewPlan 기준 예시
`Evaluation criteria:
1. Are features clearly scoped?
2. Are device targets realistic?
...`
```

### LLM 호출 토큰 한도 조정

각 Agent 프롬프트에 직접 글자 수가 명시되어 있습니다.

```typescript
// planner.ts 예시
"description": "<1 sentence, ≤80 chars>"
"acceptance_tests": ["<Given/When/Then, ≤100 chars each>"]
```

한도를 변경하면 품질과 비용이 함께 조정됩니다.

---

## 9. 비용 산정

### Task 분해 이후 LLM 호출 구조

| 단계 | 호출 수 | 입력 토큰/회 |
|------|---------|------------|
| Planner Decompose | 1 | ~500 |
| Planner Execute (feature당) | 5-8회 | ~400 |
| Designer Decompose | 1 | ~400 |
| Designer Execute (component당) | 8-12회 | ~600 |
| Developer Decompose | 1 | ~800 |
| Developer Execute (파일당) | 15-25회 | ~600 |
| Reviewer 각종 | ~10회 | ~500 |
| Tester | (코드 실행, LLM 없음) | — |

**총 LLM 호출**: 약 40-60회 (재시도 없는 경우)

**총 토큰 소비 추정** (재시도 없는 경우)

| 모델 | 추정 비용 |
|------|----------|
| `gpt-4o-mini` | ~$0.02–0.04 |
| `gemini-2.5-flash` | ~$0.01–0.02 |
| `gpt-4o` | ~$0.40–0.80 |

> 최대 재시도(5회) 기준에서는 약 2-3배 증가합니다.

---

## 10. 트러블슈팅

### "Developer LLM returned no parseable files"

Decompose 단계에서 파일 목록을 파싱하지 못한 경우입니다.

- `LLM_PROVIDER`와 API 키를 확인합니다.
- 더 강력한 모델(`gpt-4o`)로 전환해 봅니다.

### "npm install failed"

Developer가 존재하지 않는 패키지를 `package.json`에 추가한 경우입니다.

- 자동으로 Reviewer가 분석 후 재시도합니다 (최대 5회).
- 5회 초과 시 `BUILD_REPORT.md`의 Reviewer 피드백을 확인해 컨셉을 수정합니다.

### "Build failed" / TypeScript 오류

- `artifacts/<run-id>/build-N.log` 파일에서 전체 에러를 확인합니다.
- `docs/agent-comms/<run-id>/07-build-review-N.md`에서 Reviewer의 분석 결과를 확인합니다.
- 자동 재시도가 5회 모두 실패하면 컨셉을 더 단순하게 조정해 재실행합니다.

### "[ACP] ⚠️ Output exceeded budget"

콘솔에 이 경고가 출력되면 해당 Agent의 LLM 프롬프트 글자 수 제한을 더 엄격하게 수정해야 합니다. 절단되지 않은 원본이 그대로 사용되므로 즉각적인 오류는 없지만 다음 LLM 호출의 컨텍스트가 커질 수 있습니다.

### Quality Gate 실패 (partial 상태)

빌드와 E2E는 통과했지만 하네스 자체 빌드 확인에서 실패한 경우입니다.

```bash
npm run build   # 하네스 시스템 재빌드
```

---

## 내부 구조 (기여자용)

```
src/
  orchestrator.ts          ← 전체 파이프라인 제어
  agents/
    planner.ts             ← Decompose + Execute (feature당)
    designer.ts            ← Decompose + Execute (component당)
    developer.ts           ← Decompose + Execute (파일당) + npm/git
    tester.ts              ← 빌드 + E2E + cap sync
    reviewer.ts            ← 단계별 품질 검토
  utils/
    agent-comms.ts         ← ACP 파일 I/O (writeAcpFile, enforceSummaryBudget 등)
    openai.ts              ← LLM 호출 공통 인터페이스
    harness-context.ts     ← HARNESS_SPEC.md 내용을 LLM 컨텍스트로 주입
    json.ts                ← LLM JSON 응답 파싱

docs/
  HARNESS_SPEC.md          ← Agent별 계약, Task 분해 규칙, 산출물 저장 계약
  HARNESS_PRINCIPLES.md    ← 설계 철학
  AGENT_COMMS_PROTOCOL.md  ← ACP 파일 형식 명세
  USAGE_GUIDE.md           ← 이 문서
```
