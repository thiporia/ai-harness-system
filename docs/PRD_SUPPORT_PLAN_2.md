# PRD 지원 개선 계획 2차

> 비용 손실 방지를 위한 실행 전 사전 수정

---

## 변경 1 — HARNESS_SPEC.md Developer Contract: Firebase 버전 고정

Firebase 채택 시 Developer가 생성하는 `package.json`에 잘못된 버전이 들어가면
`npm install` 또는 빌드에서 바로 실패한다.

**추가 내용:**
- `firebase: ^10.x` (v9 Modular API)
- `@capacitor-community/admob: ^6.x` (Capacitor 6 기준)
- `@capacitor-firebase/messaging: ^6.x` (FCM, 선택적)
- Firebase 환경 변수 목록 → `.env.example` 필수 생성 지시

---

## 변경 2 — Planner selected 제약 max 3 → max 5

**위치**: `docs/HARNESS_SPEC.md` + `src/agents/planner.ts`

Firebase + FCM + Recharts + Jotai = 4개가 필요한데 max 3이면 하나가 빠진다.
5로 확장해 복잡한 PRD에서도 필수 라이브러리가 누락되지 않도록 한다.

---

## 변경 3 — Planner Phase 범위 인식

**위치**: `docs/HARNESS_SPEC.md` + `src/agents/planner.ts`

입력 문서에 `Phase 1만 구현`, `MVP only`, `Phase 2·3는 out-of-scope` 등의
범위 지시가 있으면 Planner가 이를 반드시 준수하도록 규칙 추가.

이를 통해 PRD 파일 앞에 한 줄만 추가하면 자동으로 범위가 좁혀진다:
```
Phase 1 MVP 기능만 구현한다. Phase 2·3는 out-of-scope로 처리한다.
```

---

## 영향 범위

| 파일 | 변경 |
|------|------|
| `docs/HARNESS_SPEC.md` | Developer Contract Firebase 버전 + Planner Phase 규칙 |
| `src/agents/planner.ts` | selected max 5, Phase scope 규칙, Firebase 감지 규칙 |
