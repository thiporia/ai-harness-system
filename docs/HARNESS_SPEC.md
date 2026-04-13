# Harness Execution Spec

이 문서는 하네스 엔지니어링의 실행 스펙(계약)이다.
원칙 문서(`HARNESS_PRINCIPLES.md`)보다 구체적인 구현/판정 기준을 담는다.

## Platform Baseline

- 타겟 디바이스는 모바일 우선(Mobile-First)이다.
- 멀티플랫폼 대응은 Capacitor를 기본 채택한다.
- Web + Android + iOS 배포 가능성을 항상 고려한다.

## Core Stack Baseline

- UI Framework: React
- Language: TypeScript
- 상태 저장소가 필요하면 Jotai를 우선 사용한다.
- 서버 데이터 적재/조회가 필요하면 Supabase를 기본 채택한다.
- 내부 Gen AI API 연동이 필요하면 Cloudflare Worker를 통해 키를 은닉하고 호출한다.

## Planner Decision Contract

Planner는 반드시 아래 항목을 포함해 계획을 수립한다.

1. Scope
- 기능 범위와 제외 범위(out-of-scope)

2. Device Targets
- Mobile 우선 기준과 지원 플랫폼 목록

3. Stack Decision
- React/TypeScript/Capacitor 기준을 전제로 하되,
- 필요한 추가 기술을 후보 비교 후 선정한다.
- 선정 근거(생산성/유지보수/성능/검증 용이성)를 명시한다.

4. Folder Plan
- 권장 폴더 구조를 명시한다.
- 예시:
  - `src/app`
  - `src/features`
  - `src/components`
  - `src/shared`
  - `src/services`
  - `src/state`
  - `tests`
  - `docs`

5. Acceptance Tests
- 검증 가능한 시나리오 기반으로 작성한다.

## Engineering Rules

- Node 빌드 산출물(`dist/`)이 생성되어야 한다.
- 자동 버전업 가능한 빌드 경로를 제공해야 한다.
- 작업 단위별로 커밋 기록을 남기는 것을 기본 정책으로 한다.
- 변경 사항이 있으면 README와 Release Note를 갱신한다.
- Planner/Designer JSON 결과는 문서 아티팩트로 반드시 저장한다.
  - Latest:
    - `docs/artifacts/latest-plan.md`
    - `docs/artifacts/latest-design.md`
  - History:
    - `docs/artifacts/history/<run-id>-plan.md`
    - `docs/artifacts/history/<run-id>-design.md`
  - 문서 내부는 JSON code block 형태로 기록한다.

## Quality Gates

최소 게이트:

1. TypeScript 빌드 성공
2. 산출물 파일 생성 성공
3. 테스트(존재 시) 실행 성공
4. 출력 형식 계약(JSON/코드) 충족

하나라도 실패하면 미완료 처리한다.
