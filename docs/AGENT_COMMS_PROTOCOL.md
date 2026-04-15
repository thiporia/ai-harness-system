# Agent Communication Protocol (ACP) v1

에이전트 간 모든 정보 교환의 규칙을 정의한다.  
이 문서는 `HARNESS_SPEC.md`보다 낮은 수준(Low-Level)의 구현 계약이다.

> **원칙**: 에이전트는 서로의 내부 상태를 직접 참조하지 않는다.  
> 모든 소통은 **ACP .md 파일**을 통해서만 이루어진다.

---

## 1. 왜 .md 파일인가?

| 이유 | 설명 |
|------|------|
| **크기 강제** | 섹션별 문자 한도를 문서 수준에서 선언 |
| **감사 추적** | 모든 에이전트 간 메시지가 `docs/agent-comms/<run-id>/`에 영구 저장 |
| **사람이 읽을 수 있음** | 시스템 없이도 실행 흐름 파악 가능 |
| **LLM 입력 제어** | 파일을 읽어 LLM에 넘기기 전 크기 검증 강제 |
| **재현 가능성** | 동일 .md 파일로 특정 단계 단독 재실행 가능 |

---

## 2. 파일 위치 및 명명 규칙

```
docs/agent-comms/
  <run-id>/
    01-planner-output.md
    02-plan-review-<N>.md          # N = 검토 시도 횟수
    03-designer-output.md
    04-design-review-<N>.md
    05-developer-attempt-<N>.md    # N = 개발 시도 횟수
    06-tester-result-<N>.md
    07-build-review-<N>.md         # Reviewer(error) → Developer
    08-semantic-review-<N>.md      # Planner+Designer → Developer
```

- `<run-id>`: ISO 타임스탬프 (`2026-04-15T09-00-00-000Z`)
- `<N>`: 1부터 시작하는 시도 횟수
- 파일은 **덮어쓰기 금지** — 시도마다 새 번호로 생성

---

## 3. ACP 파일 구조

모든 ACP 파일은 아래 구조를 따른다.

```markdown
---
acp_version: 1
from: <agent-name>
to: <agent-name | "orchestrator">
type: <output | review | feedback>
run_id: <run-id>
attempt: <N>
timestamp: <ISO 8601>
status: <approved | rejected | success | failure | info>
---

## Summary
<!-- 필수. 최대 800자. 다음 에이전트가 판단에 필요한 핵심 정보만 담는다. -->

## Details
<!-- 선택. 최대 2,000자. 섹션을 나눠 구조화한다. -->

## References
<!-- 선택. 전체 원본 데이터의 파일 경로 목록. 본문에 원본을 넣지 않는다. -->
- Full JSON: `<path>`
- Build log: `<path>`
- Source files: `artifacts/<run-id>/`
```

---

## 4. 크기 한도 (Token Budget)

| 섹션 | 최대 문자 수 | 초과 시 |
|------|------------|---------|
| Frontmatter | 300자 | 필드 줄임 |
| Summary | **800자** | 필수 준수, 초과 불가 |
| Details | **2,000자** | 초과분은 References로 대체 |
| References | 500자 | 경로만 나열 |
| **파일 전체** | **3,500자** | 빌드 실패 처리 |

> **LLM에 ACP 파일 전달 시**: Summary 섹션만 기본 전달한다.  
> Details가 필요한 경우 명시적으로 추가하되, 전체 파일 전달은 금지한다.

---

## 5. 에이전트별 입출력 계약

### 5-1. Planner

| 항목 | 내용 |
|------|------|
| **입력** | CLI 인자 (컨셉 텍스트) |
| **출력 파일** | `01-planner-output.md` |
| **LLM 입력** | 하네스 컨텍스트 + 컨셉 텍스트 |
| **LLM 출력** | 플랜 JSON → `docs/artifacts/<run-id>-plan.json`에 원본 저장 |

**`01-planner-output.md` Summary 섹션 포함 항목** (800자 이내):
```
- 입력 컨셉: ...
- 주요 기능: (최대 5개, 한 줄씩)
- 제외 범위: (최대 3개)
- 스택 결정: React/TS/Capacitor + 추가 선택 기술
- 폴더 구조: (최대 10개 경로)
- 검증 기준 수: N개
```

---

### 5-2. reviewPlan (Reviewer → Planner)

| 항목 | 내용 |
|------|------|
| **입력 파일** | `01-planner-output.md` (Summary 섹션만) |
| **출력 파일** | `02-plan-review-<N>.md` |
| **LLM 입력** | 하네스 컨텍스트 + planner Summary + 검토 기준 |
| **LLM 출력** | `{ approved, feedback }` |

**`02-plan-review-<N>.md` Summary 섹션** (800자 이내):
```
- status: approved / rejected
- 검토 기준 통과: N/5
- 미통과 항목: (bullet)
- 수정 요청: (한 줄 요약)
```

---

### 5-3. Designer

| 항목 | 내용 |
|------|------|
| **입력 파일** | `01-planner-output.md` (Summary) |
| **참조** | awesome-design-md 관련 파일 (최대 3개 × 100줄) |
| **출력 파일** | `03-designer-output.md` |
| **LLM 입력** | 하네스 컨텍스트 + planner Summary + 디자인 레퍼런스 요약 |
| **LLM 출력** | 디자인 JSON → `docs/artifacts/<run-id>-design.json`에 원본 저장 |

> **awesome-design-md 인용 한도**: 파일당 최대 100줄. 3개 파일 합산 최대 1,800 토큰.  
> 초과 시 파일 앞 100줄만 사용하고 `[truncated]` 표기.

**`03-designer-output.md` Summary 섹션** (800자 이내):
```
- 컴포넌트 수: N개
- 컴포넌트 목록: (이름, 한 줄 설명)
- 참조한 디자인 레퍼런스: (파일명)
- 주요 디자인 결정: (최대 3개)
```

---

### 5-4. reviewDesign (Reviewer → Designer)

| 항목 | 내용 |
|------|------|
| **입력 파일** | `01-planner-output.md` (Summary) + `03-designer-output.md` (Summary) |
| **출력 파일** | `04-design-review-<N>.md` |
| **LLM 입력** | 하네스 컨텍스트 + 두 Summary 섹션 + 검토 기준 |

**`04-design-review-<N>.md` Summary 섹션** (800자 이내):
```
- status: approved / rejected
- 기능 대응 여부: N/M 컴포넌트 매핑 확인
- 누락 컴포넌트: (있을 경우)
- 수정 요청: (한 줄 요약)
```

---

### 5-5. Developer

| 항목 | 내용 |
|------|------|
| **입력 파일** | `01-planner-output.md` (Summary + Details) + `03-designer-output.md` (Summary + Details) + 이전 피드백 파일 |
| **출력 파일** | `05-developer-attempt-<N>.md` |
| **LLM 입력** | 하네스 컨텍스트 + 두 ACP 파일 내용 + 이전 피드백 Summary + 파일 매니페스트 지시 |
| **LLM 출력** | 파일 매니페스트 (`=== FILE: ... === END FILE ===`) |
| **코드 저장** | `artifacts/<run-id>/` |

> **LLM에 코드를 다시 넣지 않는다**: 재시도 시 이전 코드 전체를 프롬프트에 포함하는 것을 금지한다.  
> 대신 피드백 파일의 Summary(수정 지시)만 전달한다.

**`05-developer-attempt-<N>.md` Summary 섹션** (800자 이내):
```
- 시도 번호: N
- 생성 파일 수: N개
- 폴더 구조: (최상위 디렉터리 목록)
- 감지된 주요 컴포넌트: (최대 10개)
- npm install: 성공 / 실패
- git commit: 성공 / 실패 (hash)
```

---

### 5-6. Tester

| 항목 | 내용 |
|------|------|
| **입력** | `artifacts/<run-id>/` (파일시스템 직접 접근) |
| **출력 파일** | `06-tester-result-<N>.md` |
| **LLM 호출 없음** | Tester는 shell 명령 실행만 수행 |

**`06-tester-result-<N>.md` Summary 섹션** (800자 이내):
```
- 시도 번호: N
- npm build: 성공 / 실패
- vite preview (E2E): 성공 / 실패
- cap sync: 성공 / 실패 / 스킵
- 실패 원인 (있을 경우): <마지막 에러 메시지 1-3줄만>
```

> **전체 빌드 로그는 파일에 넣지 않는다**: 로그 전체는 `artifacts/<run-id>/build.log`에 저장하고, ACP 파일에는 마지막 에러 3줄만 기입한다.

---

### 5-7. Reviewer (에러 분석, build-review)

| 항목 | 내용 |
|------|------|
| **입력 파일** | `06-tester-result-<N>.md` (Summary 섹션만) |
| **출력 파일** | `07-build-review-<N>.md` |
| **LLM 입력** | 하네스 컨텍스트 + tester Summary (최대 800자) |
| **LLM 출력** | `{ issue, fix }` |

**`07-build-review-<N>.md` Summary 섹션** (800자 이내):
```
- 원인 (issue): <한 줄>
- 수정 지시 (fix): <구체적 한 줄>
```

---

### 5-8. Reviewer (의미 검토, semantic-review)

| 항목 | 내용 |
|------|------|
| **입력 파일** | `01-planner-output.md` (Summary) + `05-developer-attempt-<N>.md` (Summary) |
| **출력 파일** | `08-semantic-review-<N>.md` |
| **LLM 입력** | 하네스 컨텍스트 + planner Summary + developer Summary (코드 요약) |

**`08-semantic-review-<N>.md` Summary 섹션** (800자 이내):
```
- Planner 검토: approved / rejected
  - 누락 기능: (있을 경우)
- Designer 검토: approved / rejected
  - 누락 컴포넌트: (있을 경우)
- 통합 수정 지시: (있을 경우)
```

---

## 6. 금지 사항 (Forbidden Patterns)

| 금지 패턴 | 이유 | 대안 |
|----------|------|------|
| 코드 전체를 LLM 프롬프트에 포함 | 토큰 폭발 | 코드 요약(파일명 + 컴포넌트명)만 전달 |
| 빌드 로그 전체를 reviewer에 전달 | JSON 파싱 실패 원인 | 마지막 3,000자 + ACP Summary만 전달 |
| JSON 객체를 에이전트 간 직접 전달 | 크기 제어 불가 | ACP .md 파일 경유 |
| 이전 시도의 코드를 재시도 프롬프트에 포함 | 토큰 2배 낭비 | 피드백 Summary만 전달 |
| ACP 파일 없이 에이전트 간 데이터 전달 | 감사 추적 불가 | 반드시 파일 경유 |
| Details 섹션에 2,000자 초과 내용 작성 | 한도 위반 | 초과분은 References 경로로 대체 |

---

## 7. LLM 프롬프트 구성 규칙

에이전트가 LLM을 호출할 때 입력을 구성하는 규칙이다.

```
[시스템 프롬프트]
  - 에이전트 역할 설명 (~50 토큰)
  - 하네스 컨텍스트 (~1,700 토큰)
  - 출력 형식 지시 ("Output JSON only" 또는 파일 매니페스트 형식)

[유저 프롬프트]
  - ACP 파일 Summary 섹션 (최대 800자/파일, 최대 2개 파일)
  - 추가 컨텍스트 (디자인 레퍼런스 등, 최대 1,800 토큰)
  - 출력 스키마 예시

[총 입력 토큰 목표]
  - 일반 에이전트: 4,000 토큰 이하
  - Developer (파일 생성): 6,000 토큰 이하
  - 초과 시: 빌드 실패 처리 후 에러 로그 남길 것
```

---

## 8. 구현 유틸리티

`src/utils/agent-comms.ts`가 아래 인터페이스를 제공한다.

```typescript
// ACP 파일 작성
writeAcpFile(params: AcpWriteParams): string   // 파일 경로 반환

// ACP 파일에서 Summary 섹션만 읽기 (LLM 전달용)
readAcpSummary(filePath: string): string

// ACP 파일에서 Details까지 읽기
readAcpFull(filePath: string): string

// 텍스트를 Summary 한도(800자) 내로 자르기
truncateToSummary(text: string): string

// 빌드 로그를 ACP 규격으로 정리 (마지막 에러 3줄 추출)
extractBuildError(log: string): string
```

---

## 9. 에이전트 간 흐름도 (ACP 적용 후)

```
CLI 입력
  │
  ▼
Planner ──────────────────────────────→ 01-planner-output.md
  │                                              │
  └──→ reviewPlan ──→ 02-plan-review-N.md        │
       (Summary만 읽음)   (rejected? Planner 재실행)
                                                 │
                                                 ▼
Designer ←──────────────────────────── 01-planner-output.md (Summary)
  │  (+ awesome-design-md 최대 1,800 tok)
  └──→ 03-designer-output.md
         │
         └──→ reviewDesign ──→ 04-design-review-N.md
              (두 Summary 읽음)

Developer ←─── 01 Summary+Details + 03 Summary+Details + 이전 피드백 Summary
  │
  └──→ 05-developer-attempt-N.md
         │
         ▼
Tester (shell only, LLM 없음)
  └──→ 06-tester-result-N.md (에러 3줄만)
         │
         ├──[실패]──→ Reviewer(error) ──→ 07-build-review-N.md
         │              (Summary만 읽음)       (fix 한 줄)
         │                                      └──→ Developer 재시도
         └──[성공]──→ reviewCodeVsPlan  ┐
                      reviewCodeVsDesign├──→ 08-semantic-review-N.md
                      (요약 읽음)       ┘       └──→ [rejected] Developer 재시도
                                                └──→ [approved] Quality Gate
```

---

*ACP v1.0 — 2026-04-15*
