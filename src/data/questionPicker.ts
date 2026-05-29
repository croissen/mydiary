import { Question } from '../types';
import { BUNDLED_QUESTIONS } from '../settings/defaults';
import { getRecentQuestionIds, getSetting } from '../db';

export type TimeBucket =
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'evening'
  | 'night';

export function bucketForHour(hour: number): TimeBucket {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function getPool(): Promise<Question[]> {
  const pool = await getSetting('question_pool');
  if (Array.isArray(pool) && pool.length > 0) return pool;
  return BUNDLED_QUESTIONS;
}

export async function getQuestionById(
  id: number
): Promise<Question | undefined> {
  const pool = await getPool();
  return pool.find((q) => q.id === id);
}

// Pick a question that fits the current time of day and hasn't been used in
// the last 7 days. Falls back gracefully when the pool is exhausted.
export async function pickQuestion(now: Date = new Date()): Promise<Question> {
  const pool = await getPool();
  const bucket = bucketForHour(now.getHours());
  const recent = new Set(await getRecentQuestionIds(7));

  const fits = (q: Question) => q.time_pref === bucket || q.time_pref === 'any';

  const fresh = pool.filter((q) => fits(q) && !recent.has(q.id));
  if (fresh.length > 0) return pickRandom(fresh);

  const anyFresh = pool.filter((q) => !recent.has(q.id));
  if (anyFresh.length > 0) return pickRandom(anyFresh);

  const fitsAll = pool.filter(fits);
  if (fitsAll.length > 0) return pickRandom(fitsAll);

  return pickRandom(pool.length > 0 ? pool : BUNDLED_QUESTIONS);
}
