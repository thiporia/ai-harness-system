# 진행 방향 안내: Developer 산출물 다단계 검토 파이프라인

## 문제 정의

현재 Developer 결과물 검토 구조:

```
Developer → Tester(빌드) → 실패 → Reviewer(에러분석) → 재시도
```

누락된 검토:
- **Planner 관점**: 계획한 기능이 실제로 구현됐는가?
- **Designer 관점**: 설계한 컴포넌트 구조가 코드에 반영됐는가?

빌드가 통과해도 이 두 가지가 틀릴 수 있다.

---

## 루프 복잡도 문제와 해결

단순하게 "각 검토자마다 별도 루프"를 두면:
- Tester 루프 (5회) × Planner 루프 (5회) × Designer 루프 (5회) = 최대 125회 Developer 호출
- 비용·시간 폭발

**해결: 단일 통합 루프 + 단계별 게이트**

```
Developer 시도 N (MAX=5):
  ┌─ Phase 1: 빌드 게이트 ─────────────────┐
  │  Tester → 실패? → Reviewer(에러) →     │
  │           feedback → 다음 시도          │
  └────────────────────────────────────────┘
              ↓ 빌드 성공 시에만
  ┌─ Phase 2: 의미 검토 (병렬) ────────────┐
  │  reviewCodeVsPlan(plan, 코드요약)       │
  │  reviewCodeVsDesign(design, 코드요약)  │
  └────────────────────────────────────────┘
              ↓
  모두 approved → SUCCESS
  하나라도 rejected → 피드백 통합 → 다음 시도
```

**핵심 제약**:
- 외부 루프(MAX_RETRIES=5)는 그대로 유지 — 루프 횟수 고정
- 의미 검토는 빌드 성공 시에만 실행 — 낭비 방지
- Planner + Designer 검토는 **병렬** 실행 — 지연 최소화
- 피드백은 **통합 단일 메시지**로 Developer에 전달

---

## 최대 LLM 호출 수 (변경 후)

| 단계 | 현재 | 변경 후 |
|------|------|---------|
| Developer | 5 | 5 |
| Tester | 5 | 5 |
| Reviewer(에러) | 5 | 5 (빌드 실패 시만) |
| reviewCodeVsPlan | 0 | 최대 5 (빌드 성공 시만) |
| reviewCodeVsDesign | 0 | 최대 5 (빌드 성공 시만) |
| **추가 LLM 호출** | 0 | **최대 +10** |

현실적으로는 빌드 실패 시도 + 빌드 성공 시도가 섞이므로 10회 모두 추가되는 경우는 거의 없다.

---

## 코드 요약 (Code Summary) 전략

Planner/Designer가 코드 전체를 입력받으면 토큰이 폭발함.
대신 구조화된 **코드 요약**을 생성해서 검토에 전달한다.

```
[생성된 파일 목록]
- src/features/shopping/ShoppingList.tsx
- src/features/shopping/AddItemForm.tsx
- src/components/shared/Button.tsx
...

[감지된 컴포넌트]
ShoppingList, AddItemForm, ItemCard, Button

[plan features 구현 여부 (키워드 매칭)]
- 장보기 항목 추가: ✅ (AddItemForm, handleAdd 감지)
- 항목 삭제: ✅ (handleDelete 감지)
- 가족 공유: ❌ (share, family 키워드 미감지)
```

이 요약만으로 Planner/Designer가 의미 있는 검토 가능.

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/agents/reviewer.ts` | `reviewCodeVsPlan`, `reviewCodeVsDesign` 함수 추가 |
| `src/agents/developer.ts` | `generateCodeSummary` 함수 추가 |
| `src/orchestrator.ts` | `executeDevelopmentLoop` 2단계 구조로 개편 |
| `src/agents/index.ts` | 새 export 추가 |
