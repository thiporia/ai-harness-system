# LLM 출력 크기 제어 방향 전환

## 문제

현재 전략:
1. LLM이 자유롭게 생성
2. 생성 후 `truncateToSummary()`로 강제 절단

**절단된 텍스트는 맥락이 끊겨 다음 LLM 호출의 추론을 망친다.**

## 올바른 전략

> LLM 프롬프트에 출력 크기를 명시 → LLM이 처음부터 적합한 길이로 생성

`truncateToSummary()`는 프롬프트 버그를 감지하는 안전망으로만 유지 (경고 로그 출력).

---

## 변경 대상

### 1. `agent-comms.ts`

`truncateToSummary()` → `enforceSummaryBudget()`으로 변경:
- 한도 이내면 그대로 반환
- 초과 시 `console.warn` 후 반환 (절단 금지, 경고만)
  - 절단 대신: 호출자가 프롬프트를 수정해야 한다는 신호

### 2. 각 Agent 프롬프트에 필드별 글자 수 명시

| Agent | 필드 | 제한 |
|-------|------|------|
| Planner `planFeature` | description | ≤100자 (1문장) |
| Planner `planFeature` | acceptance_tests 항목 | ≤120자, 2-4개 |
| Designer `designComponent` | description | ≤80자 (1문장) |
| Designer `designComponent` | design_notes | ≤150자 (2문장) |
| Designer `designComponent` | props 항목 | ≤30자, 3-6개 |
| Developer `decomposeFiles` | purpose | ≤80자 (already "≤15 words") |
| Reviewer `reviewPlan` | feedback | ≤300자 |
| Reviewer `reviewDesign` | feedback | ≤300자 |
| Reviewer `reviewCodeVsPlan` | feedback | ≤300자 |
| Reviewer `reviewCodeVsDesign` | feedback | ≤300자 |
| Reviewer `reviewer` | issue, fix | 각 ≤100자 |

---

## 구현 순서

1. `agent-comms.ts`: `enforceSummaryBudget()` 경고 전용으로 변경
2. `reviewer.ts`: 모든 feedback 필드에 글자 수 명시
3. `planner.ts`: description, acceptance_tests에 글자 수 명시
4. `designer.ts`: description, design_notes, props에 글자 수 명시
