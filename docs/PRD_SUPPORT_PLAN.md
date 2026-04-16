# PRD 지원 개선 계획

> 목적: 실제 기획서(partydiet-prd.md)를 하네스에 넘겼을 때 발견된 두 가지 치명적 결함 수정

---

## 변경 1 — `input-resolver.ts` MAX_TEXT_CHARS 상향

**현재**: `MAX_TEXT_CHARS = 3000`  
**변경**: `MAX_TEXT_CHARS = 8000`

**이유**: partydiet-prd.md 기준 약 6,700자. 3,000자 제한 시 기술 스택·핵심 기능·AdMob 배치·Firestore 스키마가 모두 잘림. 8,000자면 일반적인 PRD 전체를 수용할 수 있으며, Planner 프롬프트 입력 기준 약 2,000 토큰 추가 — 허용 범위 내.

---

## 변경 2 — `HARNESS_SPEC.md` Firebase 지원 추가

**현재**: Core Stack Baseline에 Supabase만 명시  
**변경**: Firebase를 명시적 대안으로 추가, Planner가 입력 문서에서 선택된 백엔드를 감지해 준수하도록 규칙 추가

**추가 내용**:
- Firebase(Firestore, Auth, Cloud Functions, FCM)를 지원 스택으로 등재
- Planner Decision Contract에 백엔드 선택 규칙 추가:
  - 입력 문서에 Firebase가 명시된 경우 → Firebase 채택
  - 명시가 없으면 → Supabase 기본
- Firebase 사용 시 Developer가 생성해야 할 필수 파일 목록 명시
  - `src/services/firebase.ts` (초기화)
  - `src/services/firestore.ts` (CRUD 헬퍼)
  - `src/services/auth.ts` (인증)
  - `src/services/fcm.ts` (FCM, 선택)

---

## 영향 범위

| 파일 | 변경 유형 |
|------|---------|
| `src/utils/input-resolver.ts` | 상수 수정 1줄 |
| `docs/HARNESS_SPEC.md` | Core Stack Baseline + Planner Decision Contract 보강 |

코드 로직 변경 없음 — TypeScript 빌드 재확인 불필요.
