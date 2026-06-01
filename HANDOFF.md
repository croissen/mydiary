# mydiary 핸드오프 (이전·이어가기)

매시간 짧은 질문 → 한 줄 답 → 정리시간(기본 23:00)에 AI가 자동으로 1인칭 일기로 합성하는 안드로이드 앱. 메모(노트)/달력/형광펜 일정 포함. 데이터는 로컬(SQLite). AI 호출 때만 응답 텍스트가 워커로 전송(서버 비저장).

저장소: https://github.com/croissen/mydiary · 최신 APK는 아래 "현재 상태" 참고.

---

## 1) 새 PC에서 이어가기 — 체크리스트

1. **토큰·키 가져오기**(아래 "가져갈 시크릿" 참고). 새 PC 비밀번호 매니저나 메모에 옮겨두세요. 잃어버려도 재발급 가능.
2. 코드 받기:
   ```
   git clone https://github.com/croissen/mydiary.git
   cd mydiary
   npm install
   ```
3. (선택) 워커 수정할 일이 생기면: `cd worker && npm install`.
4. **Claude 새 채팅을 mydiary 폴더에서 열고**, 아래 "새 채팅 시작 프롬프트"를 첫 메시지로 보내세요.

## 2) 가져갈 시크릿/계정

코드에는 비밀키가 없습니다. 아래는 빌드·배포에 필요한 것들 — 분실 시 모두 재발급 가능.

| 항목 | 어디서 다시 받나 | 용도 |
|---|---|---|
| **EXPO_TOKEN** | expo.dev → 우상단 프로필 → Access Tokens | EAS 빌드(APK 생성). 없으면 빌드 불가. |
| **Cloudflare API Token** | dash.cloudflare.com → My Profile → API Tokens → "Edit Cloudflare Workers" 템플릿 | 워커 재배포 시. 평상시엔 불필요 |
| **ANTHROPIC_API_KEY** | console.anthropic.com | 워커 시크릿으로 이미 등록돼 있어 **평상시 불필요**. 워커 처음부터 재설정 시만 필요 |
| **Anthropic(Claude) 계정** | 그냥 로그인 | 채팅 이어가기 |

**계정 식별자(공개 정보, 참고용):**
- Expo: `@croissen/mydiary` (계정 croissen214@gmail.com)
- Cloudflare 계정 ID: `5bfb9746b15c491bbdf03a3903a5be1b`
- 워커 URL: `https://mydiary-ai.croissen214.workers.dev`
- Supabase URL: `https://gxthvkejtnqdntsbktcf.supabase.co` (anonKey는 `src/auth/supabaseClient.ts`에 있음)

> **보안 주의:** 토큰을 깃에 올리거나 채팅에 그대로 붙여넣지 마세요. 빌드할 때만 환경변수로 전달.

## 3) 새 채팅 시작 프롬프트 (복붙용)

```
mydiary 프로젝트 이어서 작업할게.
저장소: https://github.com/croissen/mydiary (이미 클론·npm install 끝남)
프로젝트 루트의 HANDOFF.md를 먼저 읽고 현재 상태·구조·다음 작업을 파악해줘.
빌드(EAS)는 무료 월 한도 때문에 내가 명시적으로 "빌드해"라고 할 때만 해줘.
평소 수정 후엔 `npx tsc --noEmit`으로 로컬 검증만.
```

## 4) 프로젝트 개요

- **앱 모델:** 로컬 우선 + 선택적 클라우드(Supabase) + 7일 무료체험 후 구독(RevenueCat, 현재 스텁).
- **알림 흐름:** 고정 3~10개 시간(각각 토글·질문 직접지정 가능) + 랜덤 0~5개(09:00~22:00, 고정시간·방해금지 제외) → 알림 답장 인라인 또는 탭. 정리시간 알림 → 자동 일기 합성.
- **노트:** 검색·즐겨찾기·이름변경·삭제 + 알림(once/daily). 홈 추가 노트는 그 날짜 달력에 표시(노트탭에서는 제외).
- **달력:** 월간 그리드, 일기/노트 점 2개, 휴일 토글, 한국 공휴일 자동 빨강, 형광펜 일정(이름+색+기간, 연속 칠, 하단 목록 최대 4).
- **백업/복원:** JSON(암호화 옵션), 노트·폴더·질문 풀·하이라이트까지 포함.

## 5) 스택

- Expo SDK **56** / RN 0.85 / React 19  (지식 cutoff 이후, `AGENTS.md` 지시대로 v56 문서 확인하며 작업)
- expo-sqlite, expo-notifications, expo-file-system (**신규 `File`/`Paths` 클래스 API**), @react-navigation(native-stack + bottom-tabs), i18next(ko 채움, en/ja 빈 구조), crypto-js + **react-native-get-random-values**(App.tsx 최상단 import 유지), dayjs.
- **신규 패키지:** `react-native-purchases`(RevenueCat, 현재 스텁), `@supabase/supabase-js`, `expo-secure-store`, `expo-web-browser`, `expo-dev-client`.
- 네비: RootNavigator(스택) = Onboarding | Tabs(홈/달력/노트/설정) + Answer/Diary/NoteEditor/DateNotes/Paywall/Subscription.
- App.tsx 래핑 순서: `PurchasesProvider > AuthProvider > SettingsProvider`.

## 6) 인증/결제 구조

### 6-1. AuthContext (`src/auth/AuthContext.tsx`)
- Supabase 이메일/구글 로그인. `signIn`, `signUp`, `signInWithGoogle`, `signOut`, `updateDisplayName`, `deleteAccount`, `syncToCloud`, `restoreFromCloud`.
- URL/Key: `src/auth/supabaseClient.ts`에 하드코딩.

### 6-2. PurchasesContext (`src/purchases/PurchasesContext.tsx`) — **현재 스텁**
- `isPro: true` 하드코딩, RevenueCat 실제 호출 없음.
- RC 테스트 키(`test_xGLHPKFElcpPAsdsfkZEEVnEQab`)로 릴리즈 빌드 강제 종료됨 → 스텁 유지.
- 실제 RC 키 생기면 원래 구현으로 복원 필요.

### 6-3. Supabase 설정 (아직 미완료)
1. `src/auth/supabaseClient.ts` URL/Key는 이미 입력됨 ✓
2. **Storage 버킷 만들기:** 이름 `backups`, Public Off, RLS 정책 `(storage.foldername(name))[1] = auth.uid()::text` (SELECT/INSERT/UPDATE/DELETE).
3. **이메일 인증 끄기 권장:** Authentication → Settings → Auth Providers → Email → "Confirm email" 끄기.
4. **Google OAuth:** Authentication → Providers → Google → Enable + Android Client ID + Redirect URL `mydiary://auth/callback`.

## 7) AI 백엔드 (워커 재배포 필요)

- Cloudflare Worker: `https://mydiary-ai.croissen214.workers.dev` (**앱에 하드코딩**: `src/ai/client.ts` BACKEND_URL).
- 모델: `claude-haiku-4-5-20251001` (Anthropic). 워커 시크릿: `ANTHROPIC_API_KEY`.
- **워커 코드는 교체됐으나 아직 재배포 안 됨.**
- 재배포:
  ```
  cd worker
  npx wrangler secret put ANTHROPIC_API_KEY
  CLOUDFLARE_API_TOKEN=<토큰> npx wrangler deploy
  ```
  (10013 에러 시 재시도)

## 8) 빌드 방침 (중요)

EAS 무료 빌드 월 한도 있음 → **자동 빌드 금지**. 수정 후엔 `npx tsc --noEmit`으로 로컬 검증만.

eas.json 프로필: `development`(dev client APK), `preview`(일반 APK), `production`(AAB).

빌드 명령 (PowerShell):
```powershell
$env:EXPO_TOKEN="<토큰>"; npx eas-cli build -p android --profile development --non-interactive --no-wait
```
완료 확인:
```powershell
$env:EXPO_TOKEN="<토큰>"; npx eas-cli build:view <buildId> --json 2>$null | ConvertFrom-Json | Select-Object -ExpandProperty artifacts
```

## 9) 현재 상태 (완료된 것)

- **최신 dev 빌드(a3c12f76):** 진행 중 — 완료 시 expo.dev에서 APK 다운로드.
- 구현 완료:
  - 온보딩 5단계: `Welcome → NotifIntro → NotifTimes → CompileTime → AuthPrompt`
    - AuthPrompt: 7일 무료 시작(Sheet 회원가입) / 이미 계정 있어요(Sheet 로그인) / 나중에 할래요
  - 알림: 고정 **3~10개**(+/- 버튼) + 랜덤 0~5개 + 인라인 답장 + 10분 스누즈
  - 질문 풀 30개 편집·백업 포함
  - 일기 자동생성(정리시간 1회) + 최근 7일 자동 복구 + AI 실패 시 재시도 안내
  - AI 스타일 캐주얼/문학적/심플/커스텀
  - 달력: 월간/목록, 날짜 탭→바텀시트(일기/노트/휴일토글), 점 2개(일기·노트), 공휴일 빨강, 형광펜 일정
  - 노트: 검색·즐겨찾기·이름변경·삭제, 알림(once/daily), 홈 추가 노트는 날짜 달력에 표시
  - 백업/복원(JSON, 암호화 옵션)
  - 설정 계정 섹션: 이름 편집(✏️) / 이메일 / 플랜 상태별 버튼(무료/체험중/프리미엄)
  - 구독 관리 화면: 현재 플랜·다음 결제일 / 취소 Sheet(사진 180일 경고+스토어 이동) / 회원 탈퇴 Sheet
  - 페이월: 샘플 일기 미리보기(흐림+🔒) / 무료 vs 프리미엄 비교표 / 플랜 선택 / CTA
  - Sheet 컴포넌트: 백드롭 fade + 시트만 슬라이드(분리 애니메이션)

## 10) 알려진 한계

- **플로팅 오버레이 답장 불가:** 네이티브 오버레이 모듈 + 상시 백그라운드 서비스 필요 → 채택 안 함. 헤드업 + 인라인 답장으로 대체.
- **공휴일 정확도:** Nager.Date 무료 API. 대체공휴일 등 미세 오차 가능.
- **PurchasesContext 스텁:** 현재 `isPro: true` 하드코딩 — 모든 유저가 프리미엄으로 보임.

## 11) DB 마이그레이션 — **절대 잊지 말 것**

새 컬럼 추가 시 **반드시** `src/db/index.ts`의 `ensureColumns(db, table, [...])`에 등록할 것. `CREATE TABLE IF NOT EXISTS`는 기존 테이블을 바꾸지 않아서, 빠뜨리면 **기존 사용자 기기에서 컬럼 누락 → 쿼리 실패 → 데이터 "사라짐"** 현상 발생 (과거 `note_date` 누락 사고 있었음).

## 12) 다음 할 일

- [ ] **Supabase 대시보드 설정** (섹션 6-3 참조) — Storage 버킷, 이메일 인증, Google OAuth
- [ ] **워커 재배포** (ANTHROPIC_API_KEY 필요, 섹션 7 참조)
- [ ] **RevenueCat 실제 키** 생기면 `src/purchases/PurchasesContext.tsx` 스텁 → 실제 구현으로 복원
- [ ] **[사진 기능]** 구현 필요:
  - 현재 사진 기능 **전혀 없음** (DB 컬럼 없음, UI 없음)
  - 페이월/구독관리 화면 문구 **"하루 1장" → "일기당 1장"** 으로 수정 (`PaywallScreen.tsx` COMPARE 배열, `SubscriptionScreen.tsx` 취소 Sheet)
  - 구현 범위: DiaryScreen에 사진 1장 추가/교체/삭제 UI, diaries 테이블 `photo_uri TEXT DEFAULT ''` 컬럼 추가(ensureColumns 등록 필수), expo-image-picker + expo-file-system으로 앱 내부 디렉토리 복사, 프리미엄 유저만 사용(usePro().isPro 체크)
