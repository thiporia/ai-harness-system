# Developer Required Files 보강 계획

> developer.ts decomposeFiles 프롬프트의 required 목록 누락 수정

---

## 변경 1 — developer.ts required 목록 보강

### 현재 required 목록
```
package.json, vite.config.ts, tsconfig.json, index.html,
src/main.tsx, src/App.tsx, capacitor.config.ts,
src/services/admob.ts, src/types/index.ts
```

### 추가할 항목
- `.env.example` — 항상 생성 (Firebase, Supabase, AdMob App ID 등)
- `tailwind.config.ts` + `postcss.config.js` — stack에 Tailwind 포함 시
- `src/services/firebase.ts` + `src/services/firestore.ts` + `src/services/auth.ts` — stack에 Firebase 포함 시
- `public/firebase-messaging-sw.js` — stack에 Firebase + FCM 포함 시

→ 프롬프트 내 조건부 required 블록으로 삽입

---

## 변경 2 — npm install --prefer-offline 제거

### 현재
```typescript
runShell("npm install --prefer-offline", outputDir)  // developer.ts
runShell("npm install --prefer-offline", runDir)      // tester.ts
```

### 변경
```typescript
runShell("npm install", outputDir)
runShell("npm install", runDir)
```

`--prefer-offline`은 캐시가 없는 신규 패키지(Firebase, AdMob 플러그인 등) 설치 실패를 유발한다.
