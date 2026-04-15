# AI Harness System — 사용 가이드

> 이 문서는 프로젝트를 처음 접하는 개발자를 위한 종합 가이드입니다.

---

## 목차

1. [프로젝트란?](#1-프로젝트란)
2. [사전 요구사항](#2-사전-요구사항)
3. [설치 및 설정](#3-설치-및-설정)
4. [실행 방법](#4-실행-방법)
5. [에이전트 상세](#5-에이전트-상세)
6. [산출물 읽는 법](#6-산출물-읽는-법)
7. [하네스 원칙 커스터마이징](#7-하네스-원칙-커스터마이징)
8. [비용 산정](#8-비용-산정)
9. [트러블슈팅](#9-트러블슈팅)
10. [내부 구조 (기여자용)](#10-내부-구조-기여자용)

---

## 1. 프로젝트란?

AI Harness System은 **"컨셉 텍스트 하나로 완성된 앱을 자동 생성"** 하는 멀티 에이전트 파이프라인입니다.

```bash
npm run start "가족과 함께 쓰는 식단 관리 앱"
```

위 명령 하나로 아래가 자동 수행됩니다.

- 기획 (Planner) → 기획 검토 (Reviewer)
- 디자인 (Designer, awesome-design-md 참조) → 디자인 검토 (Reviewer)
- 풀 프로젝트 코드 생성 (Developer, React + TypeScript + Vite + Capacitor)
- 실제 빌드 + E2E 서버 기동 + HTTP 응답 확인 + Capacitor sync (Tester)
- 실패 시 원인 분석 후 자동 재시도 (Reviewer → Developer, 최대 5회)
- 전 과정 상세 기록 (BUILD_REPORT.md)

### 무엇을 생성하는가?

`artifacts/<run-id>/` 아래에 실제로 동작하는 프로젝트가 생성됩니다.

```
artifacts/2026-04-15T09-00-00-000Z/
  ├── package.json          ← npm 스크립트 포함 (dev, build, preview)
  ├── vite.config.ts
  ├── tsconfig.json
  ├── index.html
  ├── capacitor.config.ts   ← iOS / Android 멀티플랫폼 설정
  ├── src/
  │   ├── main.tsx
  │   ├── app/
  │   ├── features/
  │   ├── components/
  │   ├── shared/
  │   └── ...               ← Planner가 설계한 폴더 구조 그대로
  └── BUILD_REPORT.md       ← 생성 과정 전체 기록
```

생성된 프로젝트는 즉시 실행 가능합니다.

```bash
cd artifacts/<run-id>
npm install
npm run dev
```

---

## 2. 사전 요구사항

| 항목 | 버전 / 조건 |
|------|------------|
| **Node.js** | 18 이상 (fetch API 내장 필요) |
| **npm** | 8 이상 |
| **Git** | 설치 필요 (Developer가 초기 커밋 생성) |
| **LLM API 키** | OpenAI 또는 Gemini 중 하나 |

> Capacitor 네이티브 빌드(iOS/Android)를 실제로 실행하려면 Xcode 또는 Android Studio가 필요합니다. 없어도 Web 빌드와 `cap sync` 검증까지는 정상 동작합니다.

---

## 3. 설치 및 설정

### 3-1. 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/thiporia/ai-harness-system.git
cd ai-harness-system
npm install
```

### 3-2. 환경 변수 설정

`.env` 파일을 프로젝트 루트에 생성합니다.

```dotenv
# ── LLM 공급자 선택 ─────────────────────────────
# "openai" 또는 "gemini" (기본값: openai)
LLM_PROVIDER=openai

# ── OpenAI 설정 (LLM_PROVIDER=openai 시 필요) ───
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini   # 기본값, 생략 가능

# ── Gemini 설정 (LLM_PROVIDER=gemini 시 필요) ───
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash   # 기본값, 생략 가능
```

**모델 선택 가이드**

| 상황 | 권장 모델 |
|------|----------|
| 빠른 테스트 / 비용 절감 | `gpt-4o-mini` 또는 `gemini-2.5-flash` |
| 복잡한 앱 / 높은 품질 요구 | `gpt-4o` 또는 `gpt-4.1` |

### 3-3. 빌드

오케스트레이터를 실행하려면 먼저 TypeScript를 컴파일해야 합니다.

```bash
npm run build
# → dist/ 디렉토리 생성
```

---

## 4. 실행 방법

### 기본 실행

```bash
npm run start "<앱 컨셉>"
```

컨셉은 한국어/영어 모두 가능합니다. 구체적일수록 좋은 결과가 나옵니다.

```bash
# 예시
npm run start "가족이 함께 쓰는 장보기 목록 앱"
npm run start "운동 루틴을 기록하고 통계를 보여주는 앱"
npm run start "팀원들과 일정을 공유하는 캘린더 앱"
```

컨셉을 생략하면 기본값(`React Todo App with CRUD`)이 사용됩니다.

```bash
npm run start   # → "React Todo App with CRUD" 로 실행
```

### 실행 흐름 콘솔 출력 예시

```
============================================================
[run: 2026-04-15T09-00-00-000Z]
Input: "가족이 함께 쓰는 장보기 목록 앱"
Output: ./artifacts/2026-04-15T09-00-00-000Z
============================================================

[1/5] Planning...
  → reviewPlan (1/5)
  ✅ Plan approved.

[2/5] Designing (with awesome-design-md refs)...
  [designer] Loaded design ref: todo-list.md
  [designer] Loaded design ref: form-design.md
  → reviewDesign (1/5)
  ✅ Design approved.

[3-4/5] Developing + Testing...
  Development Attempt 1/5
  Testing (build + vite preview + cap sync)...
  ✅ All tests passed.

[5/5] Quality Gate...
✅ Orchestration complete.

Build report → ./artifacts/2026-04-15T09-00-00-000Z/BUILD_REPORT.md
Latest       → ./artifacts/latest
```

### 생성된 프로젝트 실행

```bash
cd artifacts/<run-id>
npm install   # 의존성 설치
npm run dev   # 개발 서버 실행 (http://localhost:5173)
npm run build # 프로덕션 빌드
```

---

## 5. 에이전트 상세

### 5-1. Planner

**역할**: 입력 컨셉을 받아 구조화된 기획 JSON을 생성합니다.

**출력 구조**

```json
{
  "scope": {
    "in_scope": ["장보기 목록 CRUD", "가족 공유"],
    "out_of_scope": ["결제 기능", "배달 연동"]
  },
  "device_targets": ["Web", "iOS", "Android"],
  "stack_decision": {
    "fixed": ["React", "TypeScript", "Capacitor"],
    "selected": ["Jotai", "Supabase"],
    "rationale": ["실시간 동기화 필요", "상태 복잡도 낮음"]
  },
  "folder_plan": ["src/app", "src/features", "src/components", "src/shared"],
  "features": [
    { "name": "장보기 항목 추가", "description": "..." },
    ...
  ],
  "acceptance_tests": [...]
}
```

**검토 루프**: Planner 결과는 `reviewPlan`이 5가지 기준으로 심사합니다. 미승인 시 피드백과 함께 최대 5회까지 재기획합니다.

---

### 5-2. Designer

**역할**: Plan을 받아 컴포넌트 설계 JSON을 생성합니다. [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 레포지토리에서 기능 키워드에 맞는 디자인 레퍼런스 파일(최대 3개)을 자동으로 참조합니다.

**awesome-design-md 참조 방식**

1. GitHub API로 레포 파일 목록 fetch
2. Plan features 키워드 기반 관련도 점수 계산
3. 상위 3개 `.md` 파일 내용(최대 100줄)을 LLM 프롬프트에 주입

**출력 구조**

```json
{
  "components": [
    {
      "name": "ShoppingListItem",
      "description": "개별 장보기 항목 카드",
      "props": ["id", "name", "quantity", "checked", "onToggle", "onDelete"],
      "design_notes": "todo-list.md 참조: 스와이프 삭제 패턴 적용"
    }
  ],
  "design_references_used": ["todo-list.md", "form-design.md"]
}
```

**검토 루프**: `reviewDesign`이 Plan과 Design의 정합성을 검사합니다. 최대 5회 재설계.

---

### 5-3. Developer

**역할**: Plan + Design을 받아 실제 동작하는 멀티파일 프로젝트를 생성합니다.

**주요 동작**

1. LLM에게 파일 매니페스트 형식으로 전체 프로젝트 요청
2. 파싱 후 `artifacts/<run-id>/` 하위에 폴더 구조 그대로 저장
3. `npm install` 실행
4. `git init + git commit` (초기 커밋)

**LLM 출력 형식** (내부 파싱용)

```
=== FILE: package.json ===
{ "name": "my-app", ... }
=== END FILE ===

=== FILE: src/features/shopping/ShoppingList.tsx ===
import React from 'react';
...
=== END FILE ===
```

**필수 준수 사항**: Planner의 `folder_plan` 구조 그대로 파일 배치, 단일 파일(`App.tsx` 하나) 생성 금지.

---

### 5-4. Tester

**역할**: 생성된 프로젝트를 실제로 빌드하고 서버를 기동하여 동작 여부를 확인합니다.

**검증 단계**

| 단계 | 내용 | 실패 시 |
|------|------|---------|
| 1 | `package.json` 존재 확인 | 즉시 실패 반환 |
| 2 | `npm install` (미설치 시) | 즉시 실패 반환 |
| 3 | `npm run build` 실행 | 빌드 로그와 함께 실패 반환 |
| 4 | `dist/` 또는 `build/` 디렉토리 존재 확인 | 실패 반환 |
| 5 | `vite preview` 서버 기동 → HTTP 200 + HTML 응답 확인 | 실패 반환 |
| 6 | `npx cap sync` (capacitor.config.ts 있을 경우) | 실패 반환 |

---

### 5-5. Reviewer

**역할**: 모든 단계에서 접근 가능한 검토 에이전트. 세 가지 함수로 구성됩니다.

| 함수 | 호출 시점 | 입력 | 출력 |
|------|----------|------|------|
| `reviewPlan(plan)` | Planner 이후 | plan JSON | `{ approved, feedback }` |
| `reviewDesign(plan, design)` | Designer 이후 | plan + design JSON | `{ approved, feedback }` |
| `reviewer(logs)` | 빌드/테스트 실패 시 | 에러 로그 | `{ issue, fix }` |

**검토 기준 (reviewPlan)**
- 기능 범위(in/out-of-scope)가 명확한가?
- 디바이스 타겟이 스택과 현실적으로 맞는가?
- 스택이 Harness 기준(React/TS/Capacitor)에 맞는가?
- 폴더 플랜이 완전한가?
- 인수 테스트가 검증 가능하고 구체적인가?

---

### 5-6. Orchestrator

**역할**: 모든 에이전트를 순서대로 호출하고 재시도 루프를 관리합니다.

**전체 흐름 (최악의 경우)**

```
planner ×1 → reviewPlan ×1 → 미승인
planner ×2 → reviewPlan ×2 → 미승인
planner ×3 → reviewPlan ×3 → 미승인
planner ×4 → reviewPlan ×4 → 미승인
                reviewPlan ×5 → 최대 재시도 도달, 마지막 plan으로 진행

designer ×1 → reviewDesign ×1 → 미승인
...
designer ×4 → reviewDesign ×5 → 최대 재시도 도달, 마지막 design으로 진행

developer ×1 → tester → 실패 → reviewer → feedback
developer ×2 → tester → 실패 → reviewer → feedback
...
developer ×5 → tester → 실패 → 최대 재시도 도달, 실패 종료

(성공 시) Quality Gate → BUILD_REPORT.md 저장 → artifacts/latest 갱신
```

**모든 단계에서 `BUILD_REPORT.md` 는 진행 중에도 중간 저장**되므로, 실패 시에도 어디서 멈췄는지 확인 가능합니다.

---

## 6. 산출물 읽는 법

### BUILD_REPORT.md

각 실행 결과의 핵심 문서입니다.

```markdown
# Build Report

- run_id: 2026-04-15T09-00-00-000Z
- 생성 시각: 2026-04-15T09:12:34.000Z
- 입력 컨셉: 가족이 함께 쓰는 장보기 목록 앱

## Planner 요약
- Reviewer 검토 횟수: 1
- ShoppingList CRUD
- 가족 공유 기능
...

## Designer 요약
- Reviewer 검토 횟수: 2
- ShoppingListItem
- AddItemForm
...

## Developer 이력
- 총 시도 횟수: 2

### Reviewer 피드백 (시도 1)
Issue: vite.config.ts에 react() 플러그인 누락
Fix: @vitejs/plugin-react 추가 및 vite.config.ts 수정

## Quality Gate 결과
✅ 통과

## 최종 상태
✅ 성공
```

### docs/artifacts/

Planner와 Designer의 JSON 결과가 한국어 요약과 함께 저장됩니다.

```
docs/artifacts/
  latest-plan.md      ← 가장 최근 실행의 plan
  latest-design.md    ← 가장 최근 실행의 design
  history/
    2026-04-15T09-00-00-000Z-plan.md
    2026-04-15T09-00-00-000Z-design.md
    ...
```

이를 통해 여러 컨셉 실행 간의 기획/설계 변화 추이를 비교할 수 있습니다.

---

## 7. 하네스 원칙 커스터마이징

에이전트들이 공통으로 참조하는 원칙은 두 파일로 관리됩니다.

| 파일 | 역할 |
|------|------|
| `docs/HARNESS_PRINCIPLES.md` | 행동 제약, 검증 루프, 완료 조건 등 고수준 원칙 |
| `docs/HARNESS_SPEC.md` | 스택 기준, 폴더 구조, Developer/Artifact 계약 등 구체적 스펙 |

이 두 파일을 수정하면 `npm run build` 없이도 다음 실행부터 즉시 반영됩니다. (파일은 런타임에 읽힘)

**스택 변경 예시**: Vite 대신 Next.js를 기본으로 쓰고 싶다면 `HARNESS_SPEC.md`의 `Core Stack Baseline` 섹션을 수정합니다.

**재시도 횟수 변경**: `src/orchestrator.ts` 상단의 `MAX_RETRIES` 값을 수정 후 `npm run build`.

---

## 8. 비용 산정

1회 풀 실행 기준, 최대 재시도(5회) 소진 시의 최대 비용입니다.

### 호출 구조 요약

| 에이전트 | 최대 호출 수 | 입력 토큰 합계 | 출력 토큰 합계 |
|---------|------------|-------------|-------------|
| Planner | 5 | ~9,830 | ~4,500 |
| reviewPlan | 5 | ~14,000 | ~900 |
| Designer | 5 | ~23,220 | ~5,000 |
| reviewDesign | 5 | ~19,050 | ~900 |
| Developer | 5 | ~15,080 | **~35,000** |
| Reviewer(error) | 5 | ~12,600 | ~900 |
| **합계** | **30회** | **~93,780** | **~47,200** |

> Developer 출력이 전체의 74%를 차지합니다. 멀티파일 프로젝트 전체 코드를 매 시도마다 생성하기 때문입니다.

### 모델별 최대 비용

| 모델 | 입력 단가 | 출력 단가 | 최대 비용 |
|------|---------|---------|---------|
| `gpt-4o-mini` | $0.15/1M | $0.60/1M | **~$0.04 (58원)** |
| `gemini-2.5-flash` | $0.075/1M | $0.30/1M | **~$0.02 (29원)** |
| `gpt-4o` | $2.50/1M | $10.00/1M | **~$0.71 (975원)** |
| `gpt-4.1` | $2.00/1M | $8.00/1M | **~$0.57 (780원)** |

**비용 절감 팁**: OpenAI Prompt Caching 또는 Gemini Context Caching을 활용하면 하네스 컨텍스트(30회 반복 주입, 전체 입력의 ~52%) 비용을 최대 75% 절감할 수 있습니다.

---

## 9. 트러블슈팅

### "Developer LLM returned no parseable files"

LLM이 파일 매니페스트 형식(`=== FILE: ... ===`)을 따르지 않고 응답했을 때 발생합니다. 모델 품질 문제일 수 있으므로 `gpt-4o` 또는 `gpt-4.1`로 전환을 권장합니다.

### npm install 실패 (generated project)

Developer가 존재하지 않는 패키지 이름을 package.json에 넣었을 경우입니다. Reviewer가 자동으로 감지하고 재시도합니다. 5회 모두 실패하면 `BUILD_REPORT.md`의 `Reviewer 피드백` 섹션을 확인하세요.

### vite preview 서버가 30초 내에 뜨지 않음

빌드는 성공했지만 `dist/index.html`이 없거나 포트 충돌일 수 있습니다. 다른 프로세스가 4173 포트를 사용 중인지 확인하세요.

```bash
lsof -i :4173
```

### "cap sync failed"

`capacitor.config.ts`는 생성됐지만 `@capacitor/core` 패키지가 package.json에 없을 때 발생합니다. Reviewer가 다음 시도에서 수정합니다.

### LLM API 오류 (rate limit, quota)

`.env`의 API 키와 잔여 크레딧을 확인하세요. Gemini는 무료 티어에서도 동작하나 분당 요청 제한이 낮습니다. 연속 실행 시 간격을 두세요.

### TypeScript 빌드 오류 (`npm run build`)

`src/` 코드를 직접 수정했을 때 타입 오류가 생긴 경우입니다.

```bash
npx tsc --noEmit   # 오류 확인
npm run build      # 빌드
```

---

## 10. 내부 구조 (기여자용)

### 파일 구조

```
src/
  orchestrator.ts          ← 메인 진입점, 에이전트 조율
  agents/
    index.ts               ← 에이전트 re-export
    planner.ts             ← 기획 생성
    designer.ts            ← 컴포넌트 설계 (awesome-design-md 연동)
    developer.ts           ← 멀티파일 프로젝트 생성 + npm + git
    tester.ts              ← 실제 빌드 + E2E + cap sync
    reviewer.ts            ← reviewPlan / reviewDesign / reviewer
  utils/
    openai.ts              ← OpenAI / Gemini 공통 callLLM 래퍼
    harness-context.ts     ← PRINCIPLES + SPEC 파일 읽어서 컨텍스트 반환
    json.ts                ← LLM JSON 응답 파싱 유틸
    harness-principles.ts  ← (레거시, harness-context.ts로 대체)
```

### 새 에이전트 추가 방법

1. `src/agents/my-agent.ts` 생성
2. `callLLM` + `getHarnessContext` 사용
3. `src/agents/index.ts`에 export 추가
4. `orchestrator.ts`에서 원하는 단계에 호출 추가
5. `npm run build`

### LLM 공급자 추가 방법

`src/utils/openai.ts`의 `callLLM` 함수에 새 분기를 추가하고 `LLM_PROVIDER` 환경 변수 값을 늘리면 됩니다.

---

*최종 업데이트: 2026-04-15*
