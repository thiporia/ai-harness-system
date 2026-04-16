# 에러 수정 + Developer 병렬화 계획

## 에러 원인

`json.ts`의 `parseJsonResponse` fallback 경로:
```typescript
return JSON.parse(objectMatch[0]) as T;  // try/catch 없음 → SyntaxError 노출
```

오케스트레이터 Phase 3 semantic review:
```typescript
const [planCodeReview, designCodeReview] = await Promise.all([
  reviewCodeVsPlan(...),   // parseJsonResponse 내부 오류 시 uncaught
  reviewCodeVsDesign(...), // 동일
]);
```

→ LLM이 약간 깨진 JSON 반환 시 SyntaxError가 최상단 catch까지 전파 → "Orchestration Error"

## 수정 1 — json.ts

두 번째 JSON.parse도 try/catch로 감싸고, 에러 메시지에 위치 정보 추가

## 수정 2 — orchestrator.ts

semantic review, reviewPlan, reviewDesign 호출 모두 try/catch로 감싸기.
실패 시 approved:false + fallback 피드백으로 루프 계속 (중단 없음).

## 수정 3 — developer.ts Tier 병렬화

| Tier | 파일 유형 | 실행 방식 |
|------|---------|---------|
| 1 | 설정 파일 (package.json, vite.config.ts 등) | 병렬 |
| 2 | 타입 + 서비스 (types/index.ts, firebase.ts, admob.ts) | 병렬 |
| 3 | 컴포넌트 + 훅 + 피처 | 병렬 |
| 4 | 진입점 (App.tsx, main.tsx) | 병렬 |

예상 단축: 30파일 기준 ~130초 → ~35초
