// Cloudflare Worker: AI 일기 변환 프록시 (Google Gemini 버전)
// - 클라이언트가 보낸 응답 텍스트를 Gemini Flash로 일기로 합성
// - 요청/응답을 로그에 남기지 않음 (console.log 사용 금지)
// - API 키는 Worker Secret(GEMINI_API_KEY)으로만 보관
// - 모델은 GEMINI_MODEL 변수로 바꿀 수 있음 (기본: gemini-2.0-flash, 무료 티어)

export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
}

interface WireResponse {
  time: string;
  question: string;
  answer: string;
}

interface CompileBody {
  responses: WireResponse[];
  tone?: 'casual' | 'literary' | 'concise' | 'custom';
  style?: string; // free-form style instruction (used when tone === 'custom')
  language?: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function toneLabel(body: CompileBody): string {
  // Custom: let the user's free-form instruction drive the style directly.
  if (body.tone === 'custom' && body.style && body.style.trim()) {
    return `다음 화자/스타일로 써주세요: "${body.style.trim()}". 그 인물이 직접 쓴 것처럼 말투·어휘·관점을 살리되, 사실은 응답 내용만 사용`;
  }
  switch (body.tone) {
    case 'literary':
      return 'literary (문학적이고 서정적인 문체)';
    case 'concise':
      return 'simple (군더더기 없이 담백하고 간결하게)';
    default:
      return 'casual (친근한 구어체)';
  }
}

function buildPrompt(body: CompileBody): string {
  const tone = toneLabel(body);
  const lines = body.responses
    .map((r) => `- [${r.time}] (질문: ${r.question}) → ${r.answer}`)
    .join('\n');

  return `당신은 사용자가 하루 동안 시간대별로 짧게 남긴 메모들을 모아, 사용자 본인이 쓴 것 같은 '자연스럽고 매끄러운 1인칭 일기'로 정리하는 도우미입니다.

가장 중요한 원칙:
- 사용자가 실제로 적은 내용에만 충실할 것. 없는 사건·감정을 지어내거나, "심오하다" 같은 과장·철학적 수사·억지 해석을 덧붙이지 말 것.
- 실제 사람이 쓴 일기처럼 담백하고 편하게 읽히도록. 멋부린 문장보다 솔직하고 자연스러운 흐름을 우선.
- 하루의 일을 시간 순서로 자연스럽게 이어서 서술.
- 시간은 "11:45" 같은 숫자 대신 "오전 11시 45분쯤", "밤 10시쯤"처럼 자연스럽게.
- 메모가 짧거나 모호하면 억지로 늘리지 말고 담백하게.
- 길이: 200~350자.

문체: ${tone}
(위 원칙을 모두 지키면서, 말투/어조에만 이 문체를 입히세요. 문체 때문에 내용을 왜곡하거나 과장하지 마세요.)

오늘의 메모:
${lines}

위 메모를 바탕으로 일기 본문만 출력하세요. 머리말·설명·따옴표 없이 본문만.`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/compile') {
      return json({ error: 'not_found' }, 404);
    }

    let body: CompileBody;
    try {
      body = (await request.json()) as CompileBody;
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }
    if (!body.responses || body.responses.length === 0) {
      return json({ error: 'no_responses' }, 400);
    }

    const prompt = buildPrompt(body);
    const model = env.GEMINI_MODEL || DEFAULT_MODEL;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
          // 2.5 flash는 thinking이 기본 켜져 출력 토큰을 소모해 본문이 잘림.
          // 단순 합성이라 thinking 불필요 → 0으로 비활성화.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (aiRes.status === 429) {
      // 무료 티어 호출 한도 초과 — 클라이언트가 구분할 수 있게 429 그대로 전달.
      return json({ error: 'rate_limited' }, 429);
    }
    if (!aiRes.ok) {
      return json({ error: 'upstream_error', status: aiRes.status }, 502);
    }

    const data = (await aiRes.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
      }[];
    };
    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';

    if (!content) {
      return json({ error: 'empty_content' }, 502);
    }

    // 의도적으로 요청/응답 본문을 로깅하지 않음.
    return json({ content });
  },
};
