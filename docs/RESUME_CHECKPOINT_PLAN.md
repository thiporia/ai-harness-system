# Resume / Checkpoint 기능 구현 계획

## 문제

현재 구조는 Planner → Designer → Developer → Tester가 순차 실행되며,
중간 단계에서 중단되면 처음부터 재실행해야 한다.
→ 이미 소비한 토큰과 시간이 모두 낭비된다.

## 해결 방향

각 주요 단계가 완료될 때마다 **Checkpoint 파일**을 저장하고,
재실행 시 Checkpoint를 감지해 **완료된 단계를 건너뛴다.**

---

## Checkpoint 파일 구조

위치: `artifacts/<run-id>/checkpoint.json`

```json
{
  "run_id": "2026-04-15T09-00-00-000Z",
  "input": "가족이 함께 쓰는 장보기 앱",
  "completed_stage": "designer",
  "developer_attempt": 0,
  "plan": { ... },
  "design": { ... },
  "feedback": ""
}
```

`completed_stage` 값에 따라 재개 지점 결정:

| completed_stage | 재개 지점 |
|-----------------|----------|
| `"none"` | 처음부터 (Planner) |
| `"planner"` | Designer부터 |
| `"designer"` | Developer부터 |
| `"developer"` | Tester부터 (해당 attempt 재실행) |
| `"done"` | 이미 완료 — 재실행 불필요 |

---

## CLI 인터페이스

```bash
# 새 실행
npm run start "앱 컨셉"

# 최신 미완료 run 재개
npm run start --resume

# 특정 run-id 재개
npm run start --resume 2026-04-15T09-00-00-000Z
```

---

## 신규 파일

### `src/utils/checkpoint.ts`

| 함수 | 역할 |
|------|------|
| `saveCheckpoint(runDir, data)` | checkpoint.json 저장 |
| `loadCheckpoint(runDir)` | checkpoint.json 로드 |
| `findLatestIncompleteRun()` | artifacts/ 에서 미완료 run-id 탐색 |
| `resolveRunTarget(argv)` | CLI 인자 파싱 → { runId, resume, input } |

---

## 수정 파일

### `src/orchestrator.ts`

- `runOrchestrator(input, resumeRunId?)` 시그니처 변경
- 시작 시 checkpoint 로드 → `completed_stage` 확인
- 각 단계 완료 후 `saveCheckpoint()` 호출
- CLI 인자 파싱 로직을 `resolveRunTarget()`으로 분리

### Checkpoint 저장 시점

1. Planner 완료 후 → `completed_stage: "planner"`, `plan` 저장
2. Designer 완료 후 → `completed_stage: "designer"`, `design` 저장
3. Developer 시도마다 → `developer_attempt: N`, `feedback` 저장
4. 전체 완료 후 → `completed_stage: "done"`
