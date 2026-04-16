# AI Harness System(Draft)

> 컨셉 텍스트, 기획서 파일, 와이어프레임 이미지, 또는 프로젝트 폴더를 입력하면  
> Multi-Agent AI가 설계 → 코드 → 빌드 검증까지 자동으로 수행합니다.

```bash
npm run start "가족과 함께 쓰는 식단 관리 앱"   # 텍스트
npm run start ./docs/brief.md                    # 마크다운 기획서
npm run start ./wireframe.png                    # 와이어프레임 이미지 (vision)
npm run start ./project-brief/                   # 폴더 (자동 우선순위 스캔)
```

---

## 개요

AI Harness System은 **Planner → Designer → Developer → Tester** 순으로 동작하는 멀티 에이전트 오케스트레이션 시스템입니다.

각 Agent는 하나의 거대한 LLM 요청으로 모든 것을 처리하지 않습니다. **Task 단위로 쪼개어 수십 회의 짧은 LLM 호출**을 반복하고, Agent 간 모든 소통은 **ACP(Agent Communication Protocol) `.md` 파일**로 기록됩니다.

---

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env   # API 키 입력

# 3. 빌드 후 실행
npm run build
npm run start "ToDo 앱"
```

### 환경 변수

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 |
| `GEMINI_API_KEY` | Google Gemini API 키 |
| `LLM_PROVIDER` | `openai` (기본) 또는 `gemini` |
| `OPENAI_MODEL` | 기본값: `gpt-4o-mini` |
| `GEMINI_MODEL` | 기본값: `gemini-2.5-flash` |

---

## 에이전트 구조

```
사용자 입력 (텍스트 / 파일 / 이미지 / 폴더)
    │
    ▼ resolveInput() — InputContext 변환
    │
    ▼
┌────────────────────────────────────────────────────────┐
│                      Orchestrator                      │
│                                                        │
│  [1] Planner ──────────────────────────────────────    │
│       이미지 첨부 시 Vision API 자동 사용                 │
│       Decompose: feature 목록 (LLM 1회)                 │
│       Execute:   feature당 상세 계획 (LLM N회 병렬)       │
│       Review:    reviewPlan → 재기획 (최대 5회)          │
│            ↓                                           │
│  [2] Designer ─────────────────────────────────────    │
│       Decompose: component 목록 (LLM 1회)               │
│       Execute:   component당 설계 (LLM N회 순차)         │
│       Review:    reviewDesign → 재설계 (최대 5회)        │
│            ↓ awesome-design-md 자동 참조                │
│  [3] Developer ────────────────────────────────────    │
│       Decompose: 파일 목록 + 목적 (LLM 1회)              │
│       Execute:   파일당 코드 생성 (LLM N회 순차)          │
│            ↓                                           │
│  [4] Tester ───────────────────────────────────────    │
│       npm run build → vite preview → HTTP 확인          │
│       npx cap sync                                     │
│       실패 → Reviewer → Developer 재시도 (최대 5회)       │
│       성공 → Planner + Designer 병렬 의미 검토            │
│            ↓                                           │
│  [5] Quality Gate                                      │
└────────────────────────────────────────────────────────┘
    │
    ▼
artifacts/<run-id>/          ← 생성된 프로젝트
docs/agent-comms/<run-id>/   ← ACP 통신 기록 전체
```

---

## 산출물 구조

```
artifacts/
  <run-id>/                ← 실행마다 고유 폴더 (덮어쓰기 없음)
    src/                   ← Plan의 folder_plan 구조 그대로
    package.json
    vite.config.ts
    capacitor.config.ts
    BUILD_REPORT.md        ← 전 과정 상세 기록 + ACP 참조
  latest/
    BUILD_REPORT.md
    LATEST_RUN.txt

docs/
  agent-comms/<run-id>/    ← ACP 통신 기록 (감사 추적)
    01-planner-output.md
    02-plan-review-N.md
    03-designer-output.md
    04-design-review-N.md
    05-developer-attempt-N.md
    06-tester-result-N.md
    07-build-review-N.md
    08-semantic-review-N.md
  artifacts/
    latest-plan.md
    latest-design.md
    history/
```

---

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run build` | TypeScript 컴파일 (`dist/` 생성) |
| `npm run start "<입력>"` | 오케스트레이터 실행 (텍스트, 파일, 이미지, 폴더) |
| `npm run resume` | 중단된 마지막 실행 재개 |
| `npm run test` | 유닛 테스트 실행 |
| `npm run version:bump` | 패치 버전 +1 |
| `npm run build:versioned` | 버전업 + 빌드 |

### Resume (중단 재개)

실행 도중 종료되어도 완료된 단계부터 이어서 실행합니다.

```bash
# 가장 최근의 미완료 실행을 자동으로 찾아 재개
npm run resume

# run-id를 직접 지정해 재개
node dist/orchestrator.js --resume --run-id 2026-04-15T09-00-00-000Z
```

체크포인트는 `artifacts/<run-id>/checkpoint.json`에 저장됩니다. Planner, Designer, Developer 각 단계 완료 시 자동 저장되며, Developer는 시도마다 갱신됩니다.

---

## 핵심 설계 원칙

### 1. 멀티모달 입력 (InputContext)

텍스트 컨셉 외에도 파일·이미지·폴더를 입력할 수 있습니다.

| 입력 형태 | 예시 | 처리 방식 |
|-----------|------|----------|
| 텍스트 | `"ToDo 앱"` | 그대로 프롬프트에 사용 |
| 마크다운 / 텍스트 파일 | `./brief.md` | 최대 3,000자 헤더 기반 추출 |
| 이미지 (PNG/JPG 등) | `./wireframe.png` | base64 인코딩 후 Vision API |
| PDF | `./spec.pdf` | pdf-parse 텍스트 추출 |
| 폴더 | `./project-brief/` | 우선순위 스캔, 최대 5개 파일 자동 선택 |

이미지가 포함된 경우 Planner는 `callLLMWithVision`(OpenAI 또는 Gemini)으로 자동 전환됩니다.

### 2. Task 분해 (One Agent Call = One Task)
Agent는 한 번의 LLM 호출로 모든 것을 처리하지 않습니다. Decompose → Execute 2단계로 나눠 Task당 1회 LLM을 호출합니다. 한 Task 실패가 전체 재시도로 이어지지 않습니다.

### 3. ACP 기반 소통
Agent 간 데이터 전달은 `.md` 파일을 매개로 합니다. LLM에는 Summary(핵심 요약)만 전달하고, 전체 원본은 References 경로로만 기록합니다.

### 4. 프롬프트 내 출력 크기 명시
LLM 출력은 생성 후 절단하지 않습니다. 각 프롬프트에 필드별 글자 수를 직접 명시해 처음부터 최적 크기로 생성합니다. 절단은 프롬프트 버그를 감지하는 경고 안전망으로만 존재합니다.

### 5. Resume / Checkpoint

각 단계(Planner, Designer, Developer) 완료 후 자동 저장. 중단 시 `npm run resume`으로 완료된 단계는 건너뛰고 이어서 실행합니다. 토큰 낭비 없이 재시작 가능합니다.

### 6. 검토 격리
Reviewer가 개입하는 각 단계(Plan, Design, Build, Semantic)는 독립적입니다. 최대 재시도 횟수는 전체 루프에 대해 5회입니다.

---

## 생성 산출물 기술 스택

| 항목 | 내용 |
|------|------|
| UI | React + TypeScript |
| 번들러 | Vite |
| 멀티플랫폼 | Capacitor (Web / iOS / Android) |
| 상태관리 | Jotai (필요 시) |
| 서버 데이터 | Supabase (필요 시) |
| AI API 경유 | Cloudflare Worker (필요 시) |

---

## 예상 비용 (1회 실행, 최대 재시도 기준)

| 모델 | 비용 |
|------|------|
| `gpt-4o-mini` (기본) | ~$0.04 |
| `gemini-2.5-flash` | ~$0.02 |
| `gpt-4o` | ~$0.80 |

> Task 분해로 LLM 호출 횟수가 증가하지만 각 호출 토큰이 대폭 감소합니다. 상세 산정은 `docs/USAGE_GUIDE.md` 참조.

---

## 상세 문서

| 문서 | 내용 |
|------|------|
| [사용 가이드](docs/USAGE_GUIDE.md) | 설치부터 커스터마이징까지 전체 안내 |
| [Harness 원칙](docs/HARNESS_PRINCIPLES.md) | 설계 철학 |
| [Harness 실행 스펙](docs/HARNESS_SPEC.md) | Agent별 계약 및 Task 분해 규칙 |
| [ACP 통신 프로토콜](docs/AGENT_COMMS_PROTOCOL.md) | 에이전트 간 소통 형식 명세 |
| [릴리스 노트](docs/RELEASE_NOTES.md) | 버전별 변경사항 |
