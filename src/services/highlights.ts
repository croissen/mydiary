import { getKV, setKV } from '../db';

const KEY = 'highlights';

export interface HighlightRange {
  id: string;
  start: string; // YYYY-MM-DD (inclusive)
  end: string; // YYYY-MM-DD (inclusive)
  color: string; // rgba string
  label: string; // schedule text, e.g. "여름 휴가"
}

export async function getHighlights(): Promise<HighlightRange[]> {
  const raw = await getKV(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HighlightRange[];
  } catch {
    return [];
  }
}

export async function addHighlight(
  start: string,
  end: string,
  color: string,
  label: string
): Promise<void> {
  const list = await getHighlights();
  // Normalize so start <= end.
  const [s, e] = start <= end ? [start, end] : [end, start];
  list.push({ id: String(Date.now()), start: s, end: e, color, label });
  await setKV(KEY, JSON.stringify(list));
}

export async function removeHighlight(id: string): Promise<void> {
  const list = (await getHighlights()).filter((h) => h.id !== id);
  await setKV(KEY, JSON.stringify(list));
}

// Returns the highlight color covering a date, if any (first match wins).
export function colorForDate(
  highlights: HighlightRange[],
  date: string
): string | undefined {
  const h = highlights.find((x) => date >= x.start && date <= x.end);
  return h?.color;
}
