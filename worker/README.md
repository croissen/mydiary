# mydiary AI Worker (Google Gemini)

AI 일기 변환 프록시. 클라이언트가 보낸 그날의 응답을 Google Gemini Flash로 일기로 합성해 돌려줍니다. 요청/응답 본문은 저장·로깅하지 않습니다.

## 준비물

1. **Google Gemini API 키** (무료) — https://aistudio.google.com/apikey 에서 "Create API key". 무료 티어로 시작하며 결제수단 없이 사용 가능(분당/일일 호출 한도 있음).
2. **Cloudflare 계정** (무료) — Worker를 올릴 곳.

## 배포 방법

```
cd worker
npm install
npx wrangler login                       # 브라우저로 Cloudflare 로그인
npx wrangler secret put GEMINI_API_KEY   # 여기에 Gemini 키 입력
npm run deploy
```

배포 후 출력되는 주소(예: `https://mydiary-ai.<계정>.workers.dev`)를 앱의 **설정 → AI 서버 주소**에 입력하면 실제 AI 변환이 동작합니다. 비워두면 앱은 오프라인 데모(mock) 모드로 동작합니다.

## 모델 바꾸기 (선택)

기본 모델은 `gemini-2.5-flash` 입니다(무료 티어 동작 확인됨). 다른 모델을 쓰려면 `wrangler.toml`의 `[vars]`에 `GEMINI_MODEL`을 지정하거나, 배포 명령으로 환경변수를 설정하세요. 참고: `gemini-2.0-flash`는 무료 할당량이 0이라 동작하지 않습니다.

## 엔드포인트

`POST /compile`

요청 본문:
```json
{
  "responses": [{ "time": "09:00", "question": "지금 기분 어때?", "answer": "졸림" }],
  "tone": "casual",
  "language": "ko"
}
```

응답:
```json
{ "content": "오늘 아침은 조금 졸렸다 ..." }
```

## 프라이버시

- `console.log` 등 본문 로깅을 사용하지 않습니다.
- 운영 시 `wrangler tail` 같은 실시간 로그 스트리밍을 켜지 마세요.
- 사용자 식별 정보는 받지 않습니다(응답 텍스트만 전달).
