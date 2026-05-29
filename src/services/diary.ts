import { compileDiary } from '../ai/client';
import { getDiaryByDate, getResponsesByDate, upsertDiary } from '../db';
import { AiTone, AppSettings, DiaryRow } from '../types';
import { hmToMinutes, lastSevenDays, nowTimeStr, todayStr } from '../utils/date';

export interface CompileOutcome {
  diary: DiaryRow;
}

// Compile (or recompile) the diary for a given date using the day's responses.
export async function compileForDate(
  date: string,
  settings: AppSettings,
  toneOverride?: AiTone
): Promise<CompileOutcome> {
  const responses = await getResponsesByDate(date);
  const answered = responses.filter(
    (r) => r.skipped === 0 && r.answer.trim().length > 0
  );
  if (answered.length === 0) {
    throw new Error('NO_RESPONSES');
  }

  const tone = toneOverride ?? settings.ai_tone;
  const result = await compileDiary({
    date,
    responses,
    tone,
    customStyle: settings.ai_custom_style,
    language: settings.language,
  });

  await upsertDiary({
    date,
    compiled_at: Date.now(),
    content: result.content,
    tone,
    user_edited: 0,
  });

  const diary = await getDiaryByDate(date);
  if (!diary) throw new Error('SAVE_FAILED');
  return { diary };
}

export interface EnsureResult {
  created: DiaryRow[]; // diaries freshly created this run
  failed: boolean; // an AI compile attempt failed (network/quota) — ret​ry later
}

// Decide whether a date needs (re)compiling. Returns the answered responses
// when it does, or null to skip (no data, already done, or hand-edited).
async function needsCompile(
  date: string,
  settings: AppSettings
): Promise<boolean> {
  // For today, wait until the compile time. Past days are always eligible.
  if (
    date === todayStr() &&
    hmToMinutes(nowTimeStr()) < hmToMinutes(settings.diary_compile_time)
  ) {
    return false;
  }
  const responses = await getResponsesByDate(date);
  const answered = responses.filter(
    (r) => r.skipped === 0 && r.answer.trim().length > 0
  );
  if (answered.length === 0) return false;

  const existing = await getDiaryByDate(date);
  if (existing) {
    if (existing.user_edited === 1) return false; // never overwrite manual edits
    const latestTs = Math.max(...answered.map((r) => r.timestamp));
    if (latestTs <= existing.compiled_at) return false; // nothing new
  }
  return true;
}

// Auto-generate diaries for any recent day (last 7 days) that has responses
// but no up-to-date diary. Recovers days the 23:00 run missed/failed. AI
// failures are reported via `failed` (NOT swallowed as "no records"), so the
// day's responses are never lost — we just retry next time.
export async function ensureDiaries(
  settings: AppSettings
): Promise<EnsureResult> {
  const created: DiaryRow[] = [];
  let failed = false;
  for (const date of lastSevenDays()) {
    if (!(await needsCompile(date, settings))) continue;
    const hadDiary = !!(await getDiaryByDate(date));
    try {
      const { diary } = await compileForDate(date, settings);
      if (!hadDiary) created.push(diary); // announce only brand-new ones
    } catch {
      failed = true; // keep responses; surface so caller can retry
    }
  }
  return { created, failed };
}

export async function saveEditedDiary(
  date: string,
  content: string,
  tone: AiTone
): Promise<void> {
  await upsertDiary({
    date,
    compiled_at: Date.now(),
    content,
    tone,
    user_edited: 1,
  });
}
