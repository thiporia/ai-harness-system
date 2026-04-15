# ACP 구현 계획

> 이 문서는 `docs/AGENT_COMMS_PROTOCOL.md`의 스펙을 코드로 반영하기 위한 작업 계획이다.

---

## 변경 범위

### 1. 신규 파일

#### `src/utils/agent-comms.ts`

ACP 파일 I/O 유틸리티 모음.

| 함수 | 역할 |
|------|------|
| `writeAcpFile(runId, filename, data)` | ACP .md 파일 생성 (`docs/agent-comms/<run-id>/`) |
| `readAcpSummary(filePath)` | Summary 섹션만 읽어 반환 (≤800자 보장) |
| `truncateToSummary(text, max)` | 텍스트를 `max`자 이하로 자름 |
| `extractBuildError(logs)` | 빌드 로그에서 에러 3줄 추출 |
| `acpFilePath(runId, filename)` | 경로 헬퍼 |

---

### 2. 수정 파일

#### `src/orchestrator.ts`

- 각 단계마다 ACP 파일 경로를 `runId` 기반으로 계산
- `executePlanningStage` → planner 결과를 `01-planner-output.md`로 저장 후 Summary만 다음 단계에 전달
- `executeDesigningStage` → designer 결과를 `03-designer-output.md`로 저장
- review 결과 → `02-plan-review-N.md`, `04-design-review-N.md` 등으로 저장
- Developer 결과 → `05-developer-attempt-N.md`로 저장 (파일 목록 + Summary)
- Tester 결과 → `06-tester-result-N.md`로 저장 (빌드 로그는 `artifacts/<run-id>/build-N.log`에 별도 저장)
- Semantic review → `08-semantic-review-N.md`로 저장

#### 각 Agent 함수 시그니처 변경 없음

- Agent 함수 자체는 여전히 JSON 객체를 반환
- ACP 파일 쓰기는 **Orchestrator**가 담당 (Agent는 순수 로직 유지)
- Agent에게 넘기는 `feedback`은 ACP Summary 기반으로 제한

---

## ACP Summary 생성 규칙

| 대상 | Summary 내용 |
|------|-------------|
| Plan | features 목록 (이름만), stack_decision.selected |
| Design | component 이름 목록, design_references_used |
| Developer attempt | 생성된 파일 목록 (경로만) |
| Tester result | success/fail + 에러 최대 3줄 |
| Review result | approved + feedback 첫 200자 |

---

## 파일 크기 보장 전략

```
buildError = extractBuildError(logs)   // 3줄 이하
acpSummary = truncateToSummary(text, 800)
→ LLM에 전달되는 것은 항상 Summary 기반
→ 전체 로그는 artifacts/<run-id>/build-N.log 에만 저장
```

---

## 구현 순서

1. `src/utils/agent-comms.ts` 생성
2. `orchestrator.ts` 수정: 각 단계에 `writeAcpFile()` 호출 추가
3. feedback 문자열을 ACP Summary에서 생성하도록 변경
4. 빌드 로그 별도 저장 로직 추가
5. TypeScript 빌드 확인
