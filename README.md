## AI Harness System

Harness Engineering 기반의 멀티 에이전트 오케스트레이션 프로젝트입니다.

## Baseline

- Mobile-First + Capacitor 멀티플랫폼 대응
- React + TypeScript
- 상태 저장소 필요 시 Jotai 우선
- 서버 데이터 적재 필요 시 Supabase 우선
- Gen AI API 키 은닉 필요 시 Cloudflare Worker 경유

상세 실행 계약은 아래 문서를 참고합니다.

- `docs/HARNESS_PRINCIPLES.md`
- `docs/HARNESS_SPEC.md`

## Scripts

- `npm run build`: TypeScript 빌드 (`dist/` 생성)
- `npm run build:artifact`: 생성 산출물(`artifacts/App.tsx`) 내부 빌드 검증
- `npm run start`: 오케스트레이터 실행
- `npm run version:bump`: `package.json` 패치 버전 +1
- `npm run build:versioned`: 버전업 + 빌드

## Orchestrator Flow

1. Planner -> plan 생성
2. Designer -> design 생성
3. Developer -> 코드 생성
4. Tester -> 검증
5. 실패 시 Reviewer 피드백 기반 재시도 (최대 5회)
6. 성공 시 Quality Gate 실행
   - `build:artifact` 성공 (산출물 내부 빌드 파이프라인)
   - 빌드 성공
   - `dist/orchestrator.js` 존재
   - 테스트 스크립트가 실제 테스트일 경우 테스트 통과
7. Planner/Designer 문서 아티팩트 기록
   - `docs/artifacts/latest-plan.md`
   - `docs/artifacts/latest-design.md`
   - `docs/artifacts/history/*-plan.md`
   - `docs/artifacts/history/*-design.md`
   - 한국어 요약 + 원본 JSON(code block) 형태로 저장

## Change Management Rules

- 작업 단위별 커밋 기록 유지
- 코드/스펙 변경 시 README와 Release Note 갱신
