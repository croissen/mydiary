# mydiary 핸드오프

매시간 질문→한 줄 답→정리시간에 AI가 하루를 일기로 자동 합성하는 안드로이드 앱(+메모 기능). 데이터는 로컬(SQLite), AI 호출 때만 응답 텍스트가 워커로 전송(비저장).

## 현재 상태
- v1 기능 대부분 구현·동작. 최신 APK(빌드 `143a8a84`): https://expo.dev/artifacts/eas/3uT1MvmW4N9UGLAWNeMrNT.apk
- 코드는 이 폴더가 정본. git 미사용.

## 스택/주의
- Expo SDK 56 / RN 0.85 / React 19 (cutoff 이후 버전, `AGENTS.md` 지시대로 v56 문서 확인).
- expo-sqlite / expo-notifications / expo-file-system(신규 `File`,`Paths` 클래스 API) / react-navigation / i18next(ko) / crypto-js + `react-native-get-random-values`(App.tsx 최상단 import 유지) / dayjs.
- **DB 컬럼 추가 시 `src/db/index.ts`의 `ensureColumns()`에 반드시 등록** (안 하면 기존 기기 데이터 손실). 백업 schema v2.

## AI 백엔드 (배포됨)
- Worker: `https://mydiary-ai.croissen214.workers.dev` (앱에 하드코딩: `src/ai/client.ts`).
- Gemini 무료, 모델 `gemini-2.5-flash`, `thinkingBudget:0` 필수. `GEMINI_API_KEY`는 워커 시크릿.
- 재배포: `cd worker && CLOUDFLARE_API_TOKEN=<토큰> npx wrangler deploy` (10013 에러 시 재시도).

## 빌드 (EAS, preview=APK)
```
EXPO_TOKEN=<토큰> npx eas-cli build -p android --profile preview --non-interactive --no-wait
# 출력 buildId로:
EXPO_TOKEN=<토큰> npx eas-cli build:view <buildId> --json   # artifacts.applicationArchiveUrl = APK
```
- EAS: `@croissen/mydiary`, 계정 croissen214@gmail.com, 패키지 `com.mydiary.app`.
- 토큰류(EXPO_TOKEN/CLOUDFLARE_API_TOKEN/GEMINI_API_KEY)는 저장 안 함 — 필요 시 사용자에게 받기.

## 검증 루틴
`npx tsc --noEmit` → `npx expo export --platform android --output-dir dist-check`(번들 확인 후 삭제) → 빌드.

## 알려진 한계
- 플로팅 오버레이 답장: 네이티브 필요 + 자동표시는 상시 백그라운드 서비스 필요 → 불가. 헤드업 알림+인라인 답장으로 대체.
- 공휴일: Nager.Date 무료 API(캐시). 제헌절·노동절 제외했으나 대체공휴일 등 미세 오차 가능.

## 다음 할 일 (사용자 요청, 미구현)
1. 달력 점: 노트 있는 날 **진한 노란색** 점, 일기 있는 날 기존 점. 둘 다면 점 2개.
2. 달력 날짜 메뉴 "색상 지정" → **"휴일 지정/해제"** 토글(빨강 on/off)로 단순화.
3. **형광펜**: 달력 탭 줄 우측 끝 버튼. 색 커스텀 + 기간(년월일시 ~) 지정 → 그 기간을 반투명 형광펜으로 칠함(기본 노랑, 노트 점과 구별).
4. 날짜탭 팝업을 `Alert` 대신 **커스텀 Sheet 바텀시트**로 재디자인(세로 나열, 바깥/취소 탭 시 닫힘).
5. 홈 "새 노트 추가" 노트에 **note_date=오늘** 부여 → 달력에서 보이게.

자세한 코드 위치/맥락은 메모리(`project_mydiary.md`)에도 동일하게 기록됨.
