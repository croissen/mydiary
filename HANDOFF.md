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
| **EXPO_TOKEN** | expo.dev → 우상단 프로필 → Access Tokens | EAS 빌드(APK 생성). 없으면 빌드 불가. 만들 때 권한 기본값으로 OK |
| **Cloudflare API Token** | dash.cloudflare.com → My Profile → API Tokens → "Edit Cloudflare Workers" 템플릿 | 워커 재배포 시. 평상시엔 불필요 |
| **Gemini API Key** | aistudio.google.com/apikey | 이미 워커 시크릿으로 등록돼 있어 **평상시 불필요**. 워커를 처음부터 다시 만들 때만 필요 |
| **Anthropic(Claude) 계정** | 그냥 로그인 | 채팅 이어가기 |

**Cloudflare/Expo 계정 식별자(공개 정보, 참고용):**
- Expo: `@croissen/mydiary` (계정 croissen214@gmail.com)
- Cloudflare 계정 ID: `5bfb9746b15c491bbdf03a3903a5be1b`
- 워커 URL: `https://mydiary-ai.croissen214.workers.dev`

> **보안 주의:** 토큰을 깃에 올리거나 채팅에 그대로 붙여넣지 마세요. 빌드할 때만 환경변수로 전달.

## 3) 새 채팅 시작 프롬프트 (복붙용)

```
mydiary 프로젝트 이어서 작업할게.
저장소: https://github.com/croissen/mydiary (이미 클론·npm install 끝남)
프로젝트 루트의 HANDOFF.md를 먼저 읽고 현재 상태·구조·다음 작업을 파악해줘.
빌드(EAS)는 무료 월 한도 때문에 내가 명시적으로 "빌드해"라고 할 때만 해줘.
평소 수정 후엔 `npx tsc --noEmit` + `npx expo export --platform android`로 로컬 검증만.
```

## 4) 프로젝트 개요

- **핵심 가치:** "당신의 일기는 당신 폰에만 있습니다." 로컬 우선, 회원가입 없음, 서버는 AI 호출 시점만 사용.
- **알림 흐름:** 고정 5개 시간(각각 토글·질문 직접지정 가능) + 랜덤 0~5개(09:00~22:00, 고정시간·방해금지 제외) → 알림 답장 인라인 또는 탭. 23:00 정리 알림 → 자동 일기 합성.
- **노트:** 검색·즐겨찾기·이름변경·삭제 + 알림(once/daily). 홈 추가 노트는 그 날짜 달력에 표시(노트탭에서는 제외).
- **달력:** 월간 그리드, 일기/노트 점 2개, 휴일 토글, 한국 공휴일 자동 빨강, 형광펜 일정(이름+색+기간, 연속 칠, 하단 목록 최대 4).
- **백업/복원:** JSON(암호화 옵션), 노트·폴더·질문 풀·하이라이트까지 포함.

## 5) 스택

- Expo SDK **56** / RN 0.85 / React 19  (지식 cutoff 이후, `AGENTS.md` 지시대로 v56 문서 확인하며 작업)
- expo-sqlite, expo-notifications, expo-file-system (**신규 `File`/`Paths` 클래스 API**), @react-navigation(native-stack + bottom-tabs), i18next(ko 채움, en/ja 빈 구조), crypto-js + **react-native-get-random-values**(App.tsx 최상단 import 유지), dayjs.
- 네비: RootNavigator(스택) = Onboarding | Tabs(홈/달력/노트/설정) + Answer/Diary/NoteEditor/DateNotes 모달 스택.

## 6) AI 백엔드 (배포돼 있음)

- Cloudflare Worker: `https://mydiary-ai.croissen214.workers.dev` (**앱에 하드코딩**: `src/ai/client.ts` BACKEND_URL).
- 모델: `gemini-2.5-flash` (무료 티어). `gemini-2.0-flash`는 무료 할당량 0이라 429.
- **`generationConfig.thinkingConfig.thinkingBudget: 0` 필수** — 안 끄면 본문이 잘림.
- 프롬프트는 "사실에 충실한 매끄러운 1인칭 일기 + 스타일은 말투만" 원칙. 과한 해석 금지.
- 워커 재배포: `cd worker && CLOUDFLARE_API_TOKEN=<토큰> npx wrangler deploy` (10013 에러 시 재시도).

## 7) 빌드 방침 (중요)

EAS 무료 빌드 월 한도 있음 → **자동 빌드 금지**. 수정 후엔:
```
npx tsc --noEmit
npx expo export --platform android --output-dir dist-check && rm -rf dist-check
```
APK 빌드는 사용자가 명시적으로 요청할 때만:
```
EXPO_TOKEN=<토큰> npx eas-cli build -p android --profile preview --non-interactive --no-wait
# 출력 buildId로:
EXPO_TOKEN=<토큰> npx eas-cli build:view <buildId> --json   # artifacts.applicationArchiveUrl = APK URL
```

## 8) 현재 상태 (완료된 것)

- 최신 APK(빌드 fdfce3f8, 2026-05-27): `https://expo.dev/artifacts/eas/xn5PMPyR3gS122WSUyiuum.apk` *(Expo 아티팩트 URL은 기간 후 만료될 수 있음 — 폰에 보관 권장)*
- v1 기능 일체:
  - 온보딩 5단계 / 알림(고정+랜덤+인라인 답장+10분 스누즈) / 질문 풀 30개 편집·백업 포함
  - 일기 자동생성(정리시간 1회) + **최근 7일 자동 복구** + AI 실패 시 재시도 안내 (답변 절대 분실 안 됨)
  - AI 스타일 캐주얼/문학적/심플/커스텀(자유 텍스트)
  - 달력: 월간/목록, 날짜 탭 → 바텀시트(일기/노트/휴일토글), 점 2개(일기·노트), 공휴일 빨강, 형광펜 일정(이름·색·기간, 연속 칠, 하단 목록)
  - 노트: 검색·즐겨찾기·이름변경·삭제, 알림(once/daily), 홈 추가 노트는 그 날짜 달력에 표시, 자동저장(빈 노트는 폐기) + "저장되었습니다" 토스트
  - 백업/복원(JSON, 암호화 옵션, 노트·폴더·질문풀·하이라이트 포함)

## 9) 알려진 한계

- **플로팅 오버레이 답장 불가:** 네이티브 오버레이 모듈 + 상시 백그라운드 서비스 필요 → 배터리·안정성 문제로 채택 안 함. 헤드업 알림 + 인라인 답장(앱이 깨어나 저장)으로 대체.
- **공휴일 정확도:** Nager.Date 무료 API. 제헌절·노동절은 코드에서 제외했으나 대체공휴일 처리 등 미세 오차 가능. 완벽이 필요하면 한국 공공데이터포털 API(키 필요)로 교체.
- **Gemini 무료 한도:** 분당/일일 호출 제한. 정상 사용은 충분하지만 어조 빠르게 연속 변경 시 잠시 막힐 수 있음(앱이 "잠시 후 다시" 안내).

## 10) DB 마이그레이션 — **절대 잊지 말 것**

새 컬럼 추가 시 **반드시** `src/db/index.ts`의 `ensureColumns(db, table, [...])`에 등록할 것. `CREATE TABLE IF NOT EXISTS`는 기존 테이블을 바꾸지 않아서, 빠뜨리면 **기존 사용자 기기에서 컬럼 누락 → 쿼리 실패 → 데이터 "사라짐" 현상**이 발생합니다(과거 `note_date` 누락으로 노트가 전부 안 보이는 사고 있었음, ensureColumns로 해결).

## 11) 다음 할 일

현재 알려진 미구현 없음. 사용자 테스트 결과로 새 피드백이 나오면 그때 작업.
