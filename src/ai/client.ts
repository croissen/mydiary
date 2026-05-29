import { AiTone, ResponseRow } from '../types';

// Fixed backend (Cloudflare Worker proxying Google Gemini). Not user-editable.
const BACKEND_URL = 'https://mydiary-ai.croissen214.workers.dev';

export interface CompileInput {
  date: string;
  responses: ResponseRow[];
  tone: AiTone;
  customStyle?: string;
  language: string;
}

export interface CompileResult {
  content: string;
}

interface WirePayload {
  time: string;
  question: string;
  answer: string;
}

function toWire(responses: ResponseRow[]): WirePayload[] {
  return responses
    .filter((r) => r.skipped === 0 && r.answer.trim().length > 0)
    .map((r) => ({
      time: r.time,
      question: r.question_text,
      answer: r.answer.trim(),
    }));
}

export async function compileDiary(input: CompileInput): Promise<CompileResult> {
  const endpoint = BACKEND_URL.replace(/\/+$/, '') + '/compile';
  const body: Record<string, unknown> = {
    responses: toWire(input.responses),
    tone: input.tone,
    language: input.language,
  };
  // Custom style: send the free-form instruction the AI should follow.
  if (input.tone === 'custom' && input.customStyle?.trim()) {
    body.style = input.customStyle.trim();
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    throw new Error('RATE_LIMITED');
  }
  if (!res.ok) {
    throw new Error(`AI backend error: ${res.status}`);
  }
  const data = (await res.json()) as { content?: string };
  if (!data.content) {
    throw new Error('AI backend returned no content');
  }
  return { content: data.content };
}
