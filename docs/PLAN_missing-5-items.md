# 진행 방향 안내: 지침 미충족 5개 항목 순차 적용

## 적용 순서

### 1. Tester — 실제 빌드 + 서버 기동 + E2E + Capacitor 검증

**변경 파일**: `src/agents/tester.ts`, `HARNESS_SPEC.md`

- 기존 `npm run build` 유지
- `vite preview --port 4173` 백그라운드 기동 → HTTP GET 폴링 → 200 확인 → 프로세스 종료
- `capacitor.config.ts` 존재 시 `npx cap sync` 실행 → 결과 로그 포함
- 실제 네이티브 빌드(Xcode/Android SDK)는 환경 의존적이므로 `cap sync` 단계까지 검증

---

### 2. Designer — awesome-design-md 연동

**변경 파일**: `src/agents/designer.ts`, `HARNESS_SPEC.md`

- GitHub API (`api.github.com/repos/VoltAgent/awesome-design-md/contents/`) 호출 → `.md` 파일 목록 확보
- plan의 features 키워드로 관련도 높은 파일 최대 3개 선별
- raw content 다운로드 → designer LLM 프롬프트에 "Design References" 섹션으로 포함

---

### 3. Planner cross-review — 다른 AI의 기획 검토

**변경 파일**: `src/agents/reviewer.ts` (함수 추가), `src/orchestrator.ts`

- `reviewer.ts`에 `reviewPlan(plan)` 함수 추가
  - 반환: `{ approved: boolean, feedback: string }`
- 오케스트레이터: Planner 실행 후 → `reviewPlan` 호출
  - `approved: false` 시 feedback과 함께 Planner 재실행 (최대 5회)

---

### 4. Reviewer 전 단계 접근

**변경 파일**: `src/agents/reviewer.ts` (함수 추가), `src/orchestrator.ts`

- `reviewer.ts`에 `reviewDesign(plan, design)` 함수 추가
  - 반환: `{ approved: boolean, feedback: string }`
- 오케스트레이터 흐름:
  - Planner → reviewPlan (최대 5회)
  - Designer → reviewDesign (최대 5회)
  - Developer → 기존 테스트 실패 기반 리뷰 (기존 유지)

---

### 5. 사용자 컨셉 입력 — CLI 인자 처리

**변경 파일**: `src/orchestrator.ts`

- `runOrchestrator(process.argv[2] ?? DEFAULT_APP_INPUT)`
- 사용: `npm run start "나만의 메모 앱"`

---

## 변경 후 오케스트레이터 전체 흐름

```
입력: npm run start "<컨셉>"
  ↓
Planner (컨셉 → plan JSON)
  ↓
reviewPlan → 미승인 시 Planner 재실행 (최대 5회)
  ↓
Designer (plan + awesome-design-md 참조 → design JSON)
  ↓
reviewDesign → 미승인 시 Designer 재실행 (최대 5회)
  ↓
Developer Loop (plan + design → 멀티파일 프로젝트 생성)
  ↓
Tester (build + vite preview + HTTP check + cap sync)
  → 실패 시 Reviewer 피드백 → Developer 재시도 (최대 5회)
  ↓
Quality Gate → BUILD_REPORT.md 저장 → artifacts/<run-id>/ 저장
```
