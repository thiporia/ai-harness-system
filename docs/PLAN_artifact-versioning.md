# 진행 방향 안내: Artifact 버전 관리 지침 추가

## 배경

현재 `artifacts/App.tsx`는 실행할 때마다 덮어쓰이므로, 이전 생성물과 비교하거나 개선 추이를 파악할 수 없다.

## 변경 범위

### 1. `docs/HARNESS_SPEC.md`

**Artifact Storage Contract** 섹션 신규 추가:

- 산출물은 `artifacts/<run-id>/` 하위 폴더에 저장 (덮어쓰기 금지)
- 폴더 내 반드시 `BUILD_REPORT.md` 포함
  - 생성 시점, run-id, 입력 컨셉
  - Planner → Designer → Developer 각 단계 요약
  - 시도 횟수 및 Reviewer 피드백 이력
  - Quality Gate 결과
- `artifacts/latest/` 심볼릭 링크(또는 복사본)는 유지하여 최신 참조 편의성 확보

### 2. `src/orchestrator.ts`

- `developer` 호출 시 저장 경로를 `artifacts/<run-id>/App.tsx`로 변경
- `tester`, `runArtifactBuildPipeline` 대상 경로도 run-id 폴더로 변경
- `persistPlanningDocs` 와 같은 시점에 `BUILD_REPORT.md` 초안 생성 후, 단계 진행 중 내용 누적
- 오케스트레이션 완료(성공/실패 무관) 후 최종 `BUILD_REPORT.md` 저장
- `artifacts/latest/` 에 최신 산출물 복사

### 3. `src/agents/developer.ts`

- 저장 경로를 함수 인자(`outputDir`)로 받도록 시그니처 변경

## 파일 구조 (변경 후)

```
artifacts/
  <run-id>/
    App.tsx          # 생성된 산출물
    BUILD_REPORT.md  # 생성 과정 상세 기록
  latest/
    App.tsx          # 최신 산출물 복사본
    BUILD_REPORT.md
```

## BUILD_REPORT.md 포함 내용

```
# Build Report

- run_id:
- created_at:
- input:

## 단계별 요약
### Planner
### Designer
### Developer (시도 횟수, 피드백 이력)

## Quality Gate 결과
```

## 영향 범위

| 파일 | 변경 유형 |
|------|-----------|
| `docs/HARNESS_SPEC.md` | 지침 추가 |
| `src/orchestrator.ts` | 경로 로직 변경, BUILD_REPORT 생성 |
| `src/agents/developer.ts` | 저장 경로 인자화 |
