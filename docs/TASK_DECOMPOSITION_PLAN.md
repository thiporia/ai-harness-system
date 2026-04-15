# Task 분해 아키텍처 개선 계획

> 근본 문제: 모든 Agent가 자신의 전체 역할을 **단 하나의 LLM 요청**으로 처리한다.
> 이로 인해 토큰 초과, 품질 저하, JSON 파싱 실패가 발생한다.

---

## 핵심 원칙

```
One Agent Call = One Focused Task
```

각 Agent는 두 단계로 동작한다:
1. **Decompose** — "무엇을 만들어야 하는가?" (짧은 LLM 호출 1회)
2. **Execute** — 각 Task를 독립적으로 처리 (Task당 짧은 LLM 호출 N회)

LLM 입력 토큰은 항상 ≤4,000, 출력 토큰은 ≤1,500을 목표로 한다.

---

## Agent별 Task 분해 설계

### Planner Agent

| 단계 | LLM 호출 | 입력 | 출력 |
|------|----------|------|------|
| Decompose | 1회 | 사용자 컨셉 | feature 이름 목록 (JSON 배열) |
| Execute | feature당 1회 | 단일 feature 이름 | scope / acceptance_tests / device_targets |
| Aggregate | (코드) | feature 결과 목록 | 최종 Plan JSON |

```
Input: "React 가계부 앱"
→ Decompose LLM → ["수입/지출 입력", "카테고리 관리", "월별 통계", ...]
→ Execute LLM × N → 각 feature 상세 정의
→ Aggregate → Plan JSON
```

### Designer Agent

| 단계 | LLM 호출 | 입력 | 출력 |
|------|----------|------|------|
| Decompose | 1회 | Plan features | component 이름 목록 |
| Execute | component당 1회 | 단일 feature + design ref | component props / layout / design_notes |
| Aggregate | (코드) | component 결과 목록 | 최종 Design JSON |

### Developer Agent (가장 중요)

| 단계 | LLM 호출 | 입력 | 출력 |
|------|----------|------|------|
| Decompose | 1회 | Plan + Design | 파일 목록 (path + purpose + exports) |
| Execute | 파일당 1회 | 단일 파일 스펙 + 컨텍스트 | 파일 내용 |
| Post | (코드) | — | npm install + git commit |

```
Decompose LLM → [
  { path: "src/components/TodoList.tsx", purpose: "Todo 목록 렌더링", exports: ["TodoList"] },
  { path: "src/hooks/useTodos.ts", purpose: "Todo CRUD 상태 관리", exports: ["useTodos"] },
  ...
]
→ Execute LLM × N → 파일별 코드 생성
→ 파일 즉시 기록 (스트리밍 방식)
```

---

## 파일별 LLM 호출 컨텍스트 전략

파일을 생성할 때 다른 파일의 전체 코드를 전달하면 안 된다.  
대신 **exports 선언만** 공유한다.

```
"이미 생성된 파일들:
- useTodos.ts → exports: useTodos(초기state) → { todos, addTodo, removeTodo }
- types.ts     → exports: Todo { id, text, done }

지금 생성할 파일: TodoList.tsx
목적: Todo 목록을 렌더링하고 완료/삭제 버튼을 제공"
```

---

## ACP Task 파일 구조 변경

기존: Agent당 1개 ACP 파일
변경: Task당 1개 ACP 파일

```
docs/agent-comms/<run-id>/
  01-planner-decompose.md          # feature 목록
  01-planner-task-1.md             # feature 1 상세
  01-planner-task-2.md             # feature 2 상세
  ...
  05-developer-decompose.md        # 파일 목록
  05-developer-task-001.md         # 파일 001 생성
  05-developer-task-002.md         # 파일 002 생성
  ...
```

---

## 구현 범위 (이번 작업)

### 우선순위 1: Developer Agent 재설계 (즉시 효과 최대)
- `developer()` → `decomposeProject()` + `generateFile()` × N
- 파일당 LLM 1회, 파일 즉시 저장
- 실패한 파일만 재시도 가능 (전체 재시도 불필요)

### 우선순위 2: Planner Agent 재설계
- `planner()` → `listFeatures()` + `planFeature()` × N
- feature당 LLM 1회

### 우선순위 3: Designer Agent 재설계
- `designer()` → `listComponents()` + `designComponent()` × N
- component당 LLM 1회

---

## 기대 효과

| 항목 | 현재 | 개선 후 |
|------|------|---------|
| Developer LLM 입력 토큰 | ~8,000+ | ≤4,000/파일 |
| 단일 실패 시 재시도 범위 | 전체 재생성 | 실패 파일만 |
| 출력 파싱 실패율 | 높음 (긴 manifest) | 낮음 (파일 1개) |
| 코드 품질 | 낮음 (압축됨) | 높음 (집중됨) |
