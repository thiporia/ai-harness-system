# AI Harness System

> 컨셉 한 줄을 입력하면 Multi-Agent AI가 실제 동작하는 프로젝트를 자동으로 생성합니다.

## 개요

AI Harness System은 **Planner → Designer → Developer → Tester** 흐름을 가진 멀티 에이전트 오케스트레이션 시스템입니다. 사용자가 원하는 앱 컨셉만 입력하면, 내부에서 에이전트들이 협업하여 설계 → 코드 생성 → 빌드 검증 → E2E 테스트까지 자동으로 수행합니다.

```
npm run start "나만의 메모 앱"
```

실행하면 `artifacts/<run-id>/` 에 완전한 React + TypeScript + Vite 프로젝트와 상세 빌드 리포트가 생성됩니다.

---

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일에 API 키 입력
```

| 변수 | 필수 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI 사용 시 | OpenAI API 키 |
| `GEMINI_API_KEY` | Gemini 사용 시 | Google Gemini API 키 |
| `LLM_PROVIDER` | 선택 | `openai` (기본) 또는 `gemini` |
| `OPENAI_MODEL` | 선택 | 기본값: `gpt-4o-mini` |
| `GEMINI_MODEL` | 선택 | 기본값: `gemini-2.5-flash` |

### 3. 빌드 후 실행

```bash
npm run build
npm run start "ToDo 앱"
```

---

## 에이전트 구조

```
사용자 입력 (컨셉)
    │
    ▼
┌─────────────────────────────────────────────┐
│              Orchestrator                   │
│                                             │
│  [1] Planner  ──→  reviewPlan  (최대 5회)   │
│       ↓                                     │
│  [2] Designer ──→  reviewDesign (최대 5회)  │
│       ↓  (awesome-design-md 참조)           │
│  [3] Developer (멀티파일 프로젝트 생성)      │
│       ↓                                     │
│  [4] Tester   (build + E2E + cap sync)      │
│       ↓ 실패                                │
│  [5] Reviewer ──→ [3] 재시도 (최대 5회)     │
│       ↓ 성공                                │
│  [6] Quality Gate                           │
└─────────────────────────────────────────────┘
    │
    ▼
artifacts/<run-id>/
  ├── src/           (생성된 전체 프로젝트)
  ├── package.json
  └── BUILD_REPORT.md (전 과정 상세 기록)
```

---

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run build` | TypeScript 컴파일 (`dist/` 생성) |
| `npm run start "<컨셉>"` | 오케스트레이터 실행 |
| `npm run test` | 유닛 테스트 실행 |
| `npm run version:bump` | 패치 버전 +1 |
| `npm run build:versioned` | 버전업 + 빌드 |

---

## 산출물 구조

```
artifacts/
  <run-id>/              ← 실행마다 고유 폴더 (덮어쓰기 없음)
    src/                 ← 생성된 프로젝트 소스
    package.json
    vite.config.ts
    capacitor.config.ts
    BUILD_REPORT.md      ← 전 과정 상세 기록
  latest/
    BUILD_REPORT.md      ← 최신 실행 리포트
    LATEST_RUN.txt       ← 최신 run-id 참조

docs/artifacts/
  latest-plan.md         ← 최신 Planner 결과
  latest-design.md       ← 최신 Designer 결과
  history/               ← 전체 실행 이력
```

---

## 기술 스택 (생성 산출물 기준)

- **UI**: React + TypeScript
- **번들러**: Vite
- **멀티플랫폼**: Capacitor (Web / iOS / Android)
- **상태관리**: Jotai (필요 시)
- **서버 데이터**: Supabase (필요 시)
- **AI API 경유**: Cloudflare Worker (필요 시)

---

## 비용 (최대 재시도 기준, 1회 실행)

| 모델 | 최대 비용 |
|------|----------|
| `gpt-4o-mini` (기본) | ~$0.04 (약 58원) |
| `gemini-2.5-flash` | ~$0.02 (약 29원) |
| `gpt-4o` | ~$0.71 (약 975원) |

> 총 30회 LLM 호출, ~141K 토큰 기준. 상세 산정은 `docs/USAGE_GUIDE.md` 참조.

---

## 상세 문서

- [사용 가이드 (전체)](docs/USAGE_GUIDE.md)
- [Harness 원칙](docs/HARNESS_PRINCIPLES.md)
- [Harness 실행 스펙](docs/HARNESS_SPEC.md)
- [릴리스 노트](docs/RELEASE_NOTES.md)
