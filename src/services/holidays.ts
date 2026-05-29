import { getKV, setKV } from '../db';

const CACHE_KEY = 'holidays_cache';

// Korean "red day" holidays via the free Nager.Date API, cached per year.
// We drop entries that aren't actually public red days in Korea
// (Constitution Day, Labour Day) to better match the local calendar.
const EXCLUDED = new Set(['Constitution Day', 'Labour Day']);

interface NagerHoliday {
  date: string;
  name: string;
  localName: string;
}

type Cache = Record<string, string[]>;

async function readCache(): Promise<Cache> {
  const raw = await getKV(CACHE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Cache;
  } catch {
    return {};
  }
}

export async function getHolidays(year: number): Promise<Set<string>> {
  const cache = await readCache();
  const key = String(year);
  if (cache[key]) return new Set(cache[key]);

  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`
    );
    if (!res.ok) return new Set();
    const data = (await res.json()) as NagerHoliday[];
    const dates = Array.from(
      new Set(
        data.filter((h) => !EXCLUDED.has(h.name)).map((h) => h.date)
      )
    );
    cache[key] = dates;
    await setKV(CACHE_KEY, JSON.stringify(cache));
    return new Set(dates);
  } catch {
    return new Set(); // offline — no holidays this time
  }
}
