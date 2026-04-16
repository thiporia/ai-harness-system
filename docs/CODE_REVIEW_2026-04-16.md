# AI Harness System — 코드 리뷰 보고서

**일시**: 2026-04-16  
**대상**: `src/` 전체 (약 3,000 LOC, 14파일)  
**판정**: **Request Changes** — Critical 4건 수정 후 진행 권장

---

## Critical Issues 🔴

### #1 Gemini API Key URL 노출
- **파일**: `src/utils/openai.ts` (55, 134, 208행)
- `?key=${apiKey}`가 URL 쿼리에 포함 → 서버 로그, 에러 스택에 키 평문 기록
- **수정**: `x-goog-api-key` HTTP 헤더로 전달, 에러 메시지에서 URL 마스킹

### #2 Path Traversal 공격
- **파일**: `src/agents/developer.ts` (216행 `writeFile`)
- LLM이 `../../etc/passwd` 같은 경로를 반환하면 outputDir 바깥에 파일 쓰기 가능
- **수정**: `path.resolve()` 후 `absPath.startsWith(absOutputDir)` 검증 추가

### #3 npm install로 임의 코드 실행
- **파일**: `developer.ts` (375행), `tester.ts` (93행)
- LLM 생성 `package.json`의 `preinstall`/`postinstall` 스크립트가 자동 실행됨
- **수정**: `npm install --ignore-scripts` 사용 또는 Docker sandbox 격리

### #4 git add -A로 민감 파일 커밋
- **파일**: `developer.ts` (382행)
- `.env`에 실제 API 키가 포함될 경우 커밋됨
- **수정**: `.gitignore` 하드코딩 선생성 + `git add` 전 `.env` 제외 검증

---

## Warnings 🟡

| # | 파일 | 이슈 | 수정 방향 |
|---|------|------|-----------|
| 5 | `developer.ts` 338행 | 동일 Tier 내 병렬 실행 시 의존성 컨텍스트 누락 | Tier 내 토폴로지 정렬 |
| 6 | `harness-context.ts` | 매 LLM 호출마다 디스크 I/O + 전체 스펙 토큰 낭비 | lazy singleton 캐싱 |
| 7 | `tester.ts` 37-81행 | vite preview 자식 프로세스 정리 불완전 | 프로세스 그룹 kill |
| 8 | `openai.ts` 28행 | OpenAI 클라이언트 매번 재생성 | 싱글턴 패턴 |
| 9 | `openai.ts` 전체 | LLM 호출 재시도 로직 없음 (429, 500 대응 불가) | 지수 백오프 재시도 |
| 10 | `json.ts` 13행 | 탐욕적 정규식 → 잘못된 JSON 범위 매칭 | 괄호 균형 파서 |
| 11 | `agent-comms.ts` 173행 | `\Z`는 JS에서 무효 → Summary 읽기 실패 가능 | `$`로 교체 |
| 12 | 전체 | LLM 비용 상한 없음 (최악 210+ 호출) | 토큰 카운터 + MAX_TOTAL_TOKENS |
| 13 | `orchestrator.ts` 230행 | `persistPlanningDocs`의 runId 불일치 | runId 파라미터로 전달 |
| 14 | `planner.ts` 179행 | planFeature 무제한 병렬 → Rate Limit | p-limit 동시성 제한 |

---

## Suggestions 🟢

| # | 파일 | 이슈 | 개선 방향 |
|---|------|------|-----------|
| 15 | 전체 agents | `plan: any`, `design: any` 과다 사용 | 공통 types/ 인터페이스 |
| 16 | `json.ts` | `parseJsonResponse<T>` 런타임 검증 없음 | Zod 스키마 도입 |
| 17 | `orchestrator.ts` | review 실패 시 무조건 승인 | 재시도 후 폴백 |
| 18 | `openai.ts` | callLLMWithVision에 JSON 모드 미적용 | callLLMWithVisionJson 추가 |
| 19 | 전체 utils | 상대 경로 하드코딩 (cwd 의존) | __dirname 기반 해결 |
| 20 | `agent-comms.ts` | extractBuildError 3줄 한정 → 근본 원인 누락 | 첫 에러 + 마지막 요약 조합 |
| 21 | `orchestrator.ts` | `_design_feedback` 임시 프로퍼티 패턴 | 명시적 파라미터 |
| 22 | 전체 | 동기 파일 I/O | fs/promises 전환 |
| 23 | `checkpoint.ts` | run-id 폴더 필터링 없음 | ISO 타임스탬프 패턴 검증 |

---

## What Looks Good ✅

- **Task Decomposition 아키텍처** — Decompose → Execute 2단계 분리로 토큰 효율성과 실패 격리 우수
- **ACP 프로토콜** — 에이전트 간 통신이 `.md`로 기록되어 감사 추적 가능, Summary 크기 제한 명확
- **Checkpoint 재개 시스템** — attempt 단위까지 추적하는 세밀한 재개 지원
- **방어적 JSON 파싱** — 마크다운 펜스 제거, 부분 추출, try/catch 감싸기 + `callLLMJson` 도입
- **Design Reference 통합** — awesome-design-md 리포에서 키워드 기반 참조, 타임아웃 + fallback
- **BUILD_REPORT.md** — 실행 이력 구조화 기록

---

## 우선순위 권장

| 순위 | 이슈 | 핵심 위험 | 예상 공수 |
|------|------|-----------|-----------|
| 1 | #1 API 키 헤더 전환 | 보안 | 30분 |
| 2 | #2 Path Traversal 가드 | 보안 | 15분 |
| 3 | #3 npm --ignore-scripts | 보안 | 5분 |
| 4 | #4 .gitignore 선생성 | 보안 | 15분 |
| 5 | #12 비용 상한 | 비용 | 1시간 |
| 6 | #9 LLM 재시도 | 안정성 | 1시간 |
| 7 | #11 정규식 버그 | 정확성 | 5분 |
| 8 | #6 harness-context 캐싱 | 성능/비용 | 15분 |
