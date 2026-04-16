# Harness Execution Spec

이 문서는 하네스 엔지니어링의 실행 스펙(계약)이다.
원칙 문서(`HARNESS_PRINCIPLES.md`)보다 구체적인 구현/판정 기준을 담는다.

## Platform Baseline

- 타겟 디바이스는 모바일 우선(Mobile-First)이다.
- 멀티플랫폼 대응은 Capacitor를 기본 채택한다.
- Web + Android + iOS 배포 가능성을 항상 고려한다.

## Core Stack Baseline

- UI Framework: React
- Language: TypeScript
- 상태 저장소가 필요하면 Jotai를 우선 사용한다.
- 서버 데이터 적재/조회가 필요한 경우 **백엔드는 아래 규칙으로 선택한다**:

### 백엔드 선택 규칙

| 조건 | 채택 백엔드 |
|------|------------|
| 입력 문서에 Firebase가 명시된 경우 | **Firebase** (Firestore + Auth + Functions) |
| 입력 문서에 백엔드 명시 없음 | **Supabase** (기본값) |
| 입력 문서에 Supabase가 명시된 경우 | **Supabase** |

#### Firebase 채택 시 Developer 필수 생성 파일

- `src/services/firebase.ts` — Firebase 앱 초기화 및 인스턴스 export
- `src/services/firestore.ts` — Firestore CRUD 헬퍼 (컬렉션 별 read/write)
- `src/services/auth.ts` — Firebase Authentication 헬퍼
- `src/services/fcm.ts` — Firebase Cloud Messaging (푸시 알림이 명시된 경우만)
- Firebase 환경 변수는 `VITE_FIREBASE_` 접두어로 `.env`에 관리한다.

#### Firebase 채택 시 주의사항

- Firestore 실시간 리스너(`onSnapshot`)는 비용이 발생하므로 단기 이벤트(투표 등)에만 사용하고, 집계 완료 후 Cloud Functions로 스냅샷 저장한다.
- AdMob과 FCM은 Capacitor 플러그인(`@capacitor-community/admob`, `@capacitor-firebase/messaging`) 버전을 고정한다.

- 내부 Gen AI API 연동이 필요하면 Cloudflare Worker를 통해 키를 은닉하고 호출한다.

## Planner Decision Contract

Planner는 반드시 아래 항목을 포함해 계획을 수립한다.

1. Scope
- 기능 범위와 제외 범위(out-of-scope)
- **Phase 범위 준수**: 입력 문서에 "Phase N만 구현", "MVP only", "Phase M·N는 out-of-scope" 등의 범위 지시가 있으면 반드시 해당 범위만 features에 포함하고, 나머지는 out-of-scope에 명시한다.

2. Device Targets
- Mobile 우선 기준과 지원 플랫폼 목록

3. Stack Decision
- React/TypeScript/Capacitor 기준을 전제로 하되,
- 필요한 추가 기술을 후보 비교 후 선정한다.
- 선정 근거(생산성/유지보수/성능/검증 용이성)를 명시한다.
- **백엔드 선택**: 입력 문서에 Firebase가 언급된 경우 반드시 Firebase를 `selected`에 포함한다. 언급이 없으면 Supabase를 기본으로 선택한다.
- **`selected` 한도**: 최대 5개. Firebase 채택 시 `["Firebase", "Jotai", "Recharts", ...]` 형태로 필요한 것만 포함한다.
- **광고**: 입력 문서에 AdMob 배치 위치가 명시된 경우 해당 위치를 그대로 `admob` 필드에 반영한다.

4. Folder Plan
- 권장 폴더 구조를 명시한다.
- 예시:
  - `src/app`
  - `src/features`
  - `src/components`
  - `src/shared`
  - `src/services`
  - `src/state`
  - `tests`
  - `docs`

5. AdMob 광고 배치
- 모바일 앱에 AdMob 광고를 반드시 포함한다.
- 광고 유형과 위치는 UX를 해치지 않는 이상적인 위치로 선정한다.
- 권장 배치 기준:
  - **Banner**: 화면 하단 고정 (앱 전체 공통)
  - **Interstitial**: 주요 Action 완료 후 (예: 항목 저장, 단계 완료)
  - **Rewarded**: 프리미엄 기능 잠금 해제 또는 콘텐츠 추가 제공 시
- `src/services/admob.ts`에 광고 초기화 및 호출 로직을 분리한다.
- AdMob App ID는 환경 변수(`VITE_ADMOB_APP_ID`)로 관리한다.

6. Acceptance Tests
- 검증 가능한 시나리오 기반으로 작성한다.

## Engineering Rules

- Node 빌드 산출물(`dist/`)이 생성되어야 한다.
- 자동 버전업 가능한 빌드 경로를 제공해야 한다.
- 작업 단위별로 커밋 기록을 남기는 것을 기본 정책으로 한다.
- 변경 사항이 있으면 README와 Release Note를 갱신한다.
- Planner/Designer JSON 결과는 문서 아티팩트로 반드시 저장한다.
  - Latest:
    - `docs/artifacts/latest-plan.md`
    - `docs/artifacts/latest-design.md`
  - History:
    - `docs/artifacts/history/<run-id>-plan.md`
    - `docs/artifacts/history/<run-id>-design.md`
  - 문서 내부는 JSON code block 형태로 기록한다.
  - 문서는 한국어 기준으로 사람이 읽기 쉽게 요약을 먼저 제공한다.
  - 원본 JSON은 문서 하단에 그대로 병기하여 추적 가능성을 유지한다.

## Task Decomposition Contract

> **원칙**: Agent는 자신의 전체 역할을 단 하나의 LLM 호출로 처리해서는 안 된다.  
> 모든 Agent는 **Decompose → Execute** 2단계로 동작한다.

### 공통 규칙

1. **Decompose 호출**: Agent가 시작될 때 LLM을 1회 호출해 할 일 목록(Task List)을 획득한다.
   - 입력 토큰 목표: ≤2,000
   - 출력 형식: JSON 배열 (`[{id, name, ...}]`)

2. **Execute 호출**: Task마다 LLM을 1회 호출해 처리한다.
   - 입력 토큰 목표: ≤4,000 (해당 Task 컨텍스트만 포함)
   - 출력 토큰 목표: ≤1,500

3. **Task 컨텍스트 공유**: Execute 호출 시 이전 Task의 전체 결과물을 전달하지 않는다.
   - **허용**: exports 선언, 파일 이름 목록, 함수 시그니처
   - **금지**: 이전 Task의 전체 코드, 이전 LLM 응답 원본

4. **Task 실패 격리**: 한 Task가 실패해도 다른 Task는 영향받지 않는다. 실패한 Task만 재시도한다.

5. **ACP Task 파일**: Task마다 ACP `.md` 파일을 생성한다.
   - 파일명: `<stage>-task-<N>.md` (예: `05-developer-task-003.md`)

### Agent별 Task 단위

| Agent | Decompose 결과 | Execute 단위 |
|-------|--------------|-------------|
| Planner | feature 이름 목록 | feature 1개 상세 계획 |
| Designer | component 이름 목록 | component 1개 설계 |
| Developer | 파일 경로 + 목적 목록 | 파일 1개 코드 생성 |
| Reviewer | (해당 없음 — 항상 단일 대상) | — |
| Tester | (단계별 실행) | — |

---

## Developer Decision Contract

Developer는 단일 파일 생성을 금지한다. 반드시 아래 기준을 따른다.

1. **Planner의 `folder_plan` 준수 의무**
   - LLM이 반환한 파일 매니페스트를 `runDir/` 하위에 구조 그대로 저장한다.
   - `src/app`, `src/features`, `src/components`, `src/shared` 등 플랜 구조를 반영한다.

2. **npm 프로젝트 초기화 필수**
   - `package.json` 을 생성하거나 LLM이 제공한 것을 저장한다.
   - `runDir` 내에서 `npm install` 을 실행하여 의존성을 설치한다.
   - 빌드 스크립트(`npm run build`)가 동작 가능한 상태여야 한다.

3. **git 초기화 필수**
   - `runDir` 내에서 `git init` 후 초기 커밋을 생성한다.
   - 커밋 메시지: `feat: initial scaffold by Developer Agent`

4. **LLM 파일 출력 형식**
   - LLM은 파일 매니페스트를 아래 구분자 형식으로 반환한다:
   ```
   === FILE: <상대경로> ===
   <파일 내용>
   === END FILE ===
   ```
   - Developer는 이 형식을 파싱하여 각 파일을 `runDir/` 하위에 저장한다.

5. **스택 준수**
   - React + TypeScript + Vite 기반으로 스캐폴딩한다.
   - Capacitor 설정(`capacitor.config.ts`)을 포함한다.
   - plan의 `stack_decision.selected` 추가 기술을 반영한다.

6. **Firebase 채택 시 추가 규칙**

   plan의 `stack_decision.selected`에 Firebase가 포함된 경우 반드시 준수한다.

   **필수 package.json 의존성 (버전 고정)**
   ```json
   {
     "firebase": "^10.14.0",
     "@capacitor-community/admob": "^6.0.0",
     "@capacitor-firebase/messaging": "^6.0.0"
   }
   ```
   - `firebase` v10은 Modular API(`import { getFirestore } from 'firebase/firestore'`)를 사용한다. v8 namespace API(`firebase.firestore()`) 사용 금지.
   - FCM이 필요한 경우에만 `@capacitor-firebase/messaging`을 포함한다.

   **필수 생성 파일**
   - `src/services/firebase.ts` — `initializeApp()` + 각 서비스 인스턴스 export
   - `src/services/firestore.ts` — 컬렉션별 CRUD 헬퍼
   - `src/services/auth.ts` — Firebase Auth 헬퍼
   - `src/services/fcm.ts` — FCM 초기화 및 토큰 요청 (FCM 포함 시)
   - `public/firebase-messaging-sw.js` — FCM 서비스 워커 (FCM 포함 시)

   **`.env.example` 필수 포함 항목**
   ```
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   ```

   **Firebase 초기화 패턴** — `src/services/firebase.ts`는 반드시 이 패턴을 따른다:
   ```typescript
   import { initializeApp, getApps } from 'firebase/app';
   // getApps()로 중복 초기화 방지
   const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
   ```
   모듈 최상단에서 직접 초기화하되, `getApps()` 가드를 반드시 포함한다.

## Artifact Storage Contract

산출물(생성된 제품 코드)은 실행마다 고유 폴더에 저장한다. **덮어쓰기는 금지한다.**

### 폴더 구조

```
artifacts/
  <run-id>/
    package.json       # 프로젝트 설정
    src/               # plan의 folder_plan 구조대로
    BUILD_REPORT.md    # 생성 과정 상세 기록
  latest/
    (최신 run-id 산출물 복사본)
    BUILD_REPORT.md
```

- `<run-id>` 형식: `YYYY-MM-DDTHH-MM-SS-mmmZ` (ISO 타임스탬프 기반)
- `latest/` 는 매 실행 후 최신 산출물로 갱신한다.

### BUILD_REPORT.md 필수 포함 항목

각 run-id 폴더 내 `BUILD_REPORT.md`는 아래 항목을 반드시 기술한다.

1. **메타데이터**: run_id, 생성 시각, 입력 컨셉
2. **Planner 요약**: 주요 기능, 범위, 스택 결정 근거
3. **Designer 요약**: 컴포넌트 구성, 참조한 디자인 레퍼런스
4. **Developer 이력**: 총 시도 횟수, 각 시도별 Reviewer 피드백 내용
5. **Quality Gate 결과**: 각 게이트 통과/실패 여부 및 로그
6. **최종 상태**: 성공 / 부분 완료 / 실패 + 사유

> 이 기록을 통해 생성물 간 개선 추이를 추적할 수 있어야 한다.

## Quality Gates

최소 게이트:

1. 산출물 내부 빌드 파이프라인 성공 (`npm run build:artifact`)
1. TypeScript 빌드 성공
2. 산출물 파일 생성 성공
3. 테스트(존재 시) 실행 성공
4. 출력 형식 계약(JSON/코드) 충족

하나라도 실패하면 미완료 처리한다.
