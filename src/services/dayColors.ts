import { getKV, setKV } from '../db';

const KEY = 'day_colors';

// User-assigned color tag per date (e.g. mark a personal day off red).
export type DayColorKey = 'red' | 'blue' | 'green';

export async function getDayColors(): Promise<Record<string, DayColorKey>> {
  const raw = await getKV(KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DayColorKey>;
  } catch {
    return {};
  }
}

export async function setDayColor(
  date: string,
  color: DayColorKey | null
): Promise<void> {
  const map = await getDayColors();
  if (color) map[date] = color;
  else delete map[date];
  await setKV(KEY, JSON.stringify(map));
}
