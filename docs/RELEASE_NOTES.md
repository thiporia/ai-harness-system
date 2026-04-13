# Release Notes

## 2026-04-13

### Added

- `docs/HARNESS_SPEC.md` 추가
  - Mobile-First + Capacitor 기준
  - React + TypeScript 기준
  - Jotai/Supabase/Cloudflare Worker 정책
  - 품질 게이트/완료 조건/운영 규칙 명시
- `src/utils/harness-context.ts` 추가
  - 원칙 + 스펙 문서를 합쳐 에이전트 프롬프트 컨텍스트로 제공
- `scripts/bump-version.js` 추가
  - 패치 버전 자동 증가 지원
- `README.md` 신규 작성
  - 실행/운영 기준 및 스크립트 문서화

### Changed

- Planner/Designer/Developer/Reviewer가
  - `HARNESS_PRINCIPLES` + `HARNESS_SPEC`를 함께 참조하도록 변경
- `orchestrator.ts`
  - 품질 게이트(build/dist/test) 실행 단계 추가
- `package.json`
  - `version:bump`, `build:versioned` 스크립트 추가

### Notes

- 테스트 스크립트가 기본 placeholder인 경우 테스트 게이트는 skip 처리됨.
- 실제 테스트 도입 시 자동으로 품질 게이트에 포함됨.

