# 진행 방향 안내: Developer Agent 전면 개선

## 문제

현재 `developer.ts` 는 Planner의 `folder_plan`, `stack_decision` 등을 입력받으면서도
프롬프트가 **"단일 파일 App.tsx 생성"** 으로 하드코딩되어 있다.

결과적으로:
- Planner가 설계한 폴더 구조 무시
- npm 프로젝트 초기화 없음
- git 초기화 없음
- Tester도 정적 정규식 검사만 하므로 실제 빌드 검증 불가

## 변경 범위

### 1. `src/agents/developer.ts` — 전면 재작성

**LLM 출력 형식 변경**: JSON 파일 매니페스트

LLM이 아래 형식으로 생성할 파일 목록과 내용을 반환:

```
=== FILE: package.json ===
{ ... }
=== END FILE ===

=== FILE: src/main.tsx ===
import ...
=== END FILE ===
```

**실행 흐름**:
1. LLM에게 plan/design 기반 전체 프로젝트 파일 생성 요청
2. 파일 매니페스트 파싱 → `runDir/` 하위에 각 파일 저장
3. `npm install` 실행 (runDir 내)
4. `git init && git add . && git commit` 실행 (runDir 내)

**LLM 프롬프트 요구사항**:
- plan의 `folder_plan`, `stack_decision`, `features` 를 그대로 반영
- React + TypeScript + Vite 기반 프로젝트 스캐폴딩
- Capacitor 설정 포함 (HARNESS_SPEC 준수)
- 파일 구조는 plan의 folder_plan 준수

### 2. `src/agents/tester.ts` — 실제 빌드 실행으로 교체

현재 정규식 검사 → **실제 빌드 실행**으로 전환:

1. `runDir`에 `package.json` 존재 확인
2. `npm run build` 실행 (runDir 내)
3. 빌드 성공 여부 + 로그 반환

### 3. `src/orchestrator.ts` — Quality Gate 간소화

- `runArtifactBuildPipeline`: tester가 실제 빌드를 이미 수행하므로 중복 제거
- dist 체크는 harness system 자체 dist만 유지

### 4. `HARNESS_SPEC.md` — Developer Decision Contract 섹션 추가

- 단일 파일 생성 금지
- plan의 folder_plan 준수 의무
- npm/git 초기화 필수

## 파일별 변경 요약

| 파일 | 변경 |
|------|------|
| `docs/HARNESS_SPEC.md` | Developer Decision Contract 추가 |
| `src/agents/developer.ts` | 전면 재작성 (멀티파일 + npm + git) |
| `src/agents/tester.ts` | 실제 빌드 실행으로 교체 |
| `src/orchestrator.ts` | Quality Gate 중복 제거 |
