import dayjs from 'dayjs';
import { AiTone } from '../types';

export function todayStr(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function nowTimeStr(): string {
  return dayjs().format('HH:mm');
}

export function dateStr(d: Date | dayjs.Dayjs): string {
  return dayjs(d).format('YYYY-MM-DD');
}

export function parseHM(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
  return { hour: h || 0, minute: m || 0 };
}

export function hmToMinutes(hm: string): number {
  const { hour, minute } = parseHM(hm);
  return hour * 60 + minute;
}

export function minutesToHM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Returns true if `hm` falls inside the quiet window [start, end).
// Handles windows that wrap past midnight (e.g. 22:00 -> 07:00).
export function isInQuietHours(
  hm: string,
  start: string,
  end: string
): boolean {
  const t = hmToMinutes(hm);
  const s = hmToMinutes(start);
  const e = hmToMinutes(end);
  if (s === e) return false;
  if (s < e) return t >= s && t < e;
  return t >= s || t < e;
}

export function formatLongDate(date: string, locale = 'ko'): string {
  const d = dayjs(date);
  if (locale === 'ko') {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.year()}년 ${d.month() + 1}월 ${d.date()}일 (${weekdays[d.day()]})`;
  }
  return d.format('YYYY-MM-DD');
}

export function isToday(date: string): boolean {
  return date === todayStr();
}

// Default note title from current date+time, e.g. "5월 22일 13:45".
export function noteDefaultTitle(): string {
  const d = dayjs();
  return `${d.month() + 1}월 ${d.date()}일 ${d.format('HH:mm')}`;
}

function ampm(h: number): string {
  return h < 12 ? '오전' : '오후';
}
function h12(h: number): number {
  const x = h % 12;
  return x === 0 ? 12 : x;
}
function periodWord(h: number): string {
  if (h < 6) return '새벽';
  if (h < 12) return '아침';
  if (h < 13) return '정오';
  if (h < 18) return '오후';
  if (h < 21) return '저녁';
  return '밤';
}

// Turn "HH:MM" into a natural Korean time phrase, varied by diary tone.
// casual keeps the minutes ("오전 11시 45분쯤"), literary is loose and
// evocative ("아침 11시를 넘긴 무렵"), concise drops minutes ("오전 11시").
export function naturalTime(hm: string, tone: AiTone): string {
  const { hour, minute } = parseHM(hm);
  const ap = ampm(hour);
  const h = h12(hour);

  if (tone === 'concise') {
    return `${ap} ${h}시`;
  }

  if (tone === 'literary') {
    const p = periodWord(hour);
    if (minute < 23) return `${p} ${h}시 무렵`;
    if (minute < 38) return `${p} ${h}시 반 무렵`;
    return `${p} ${h}시를 넘긴 무렵`;
  }

  // casual
  let base = `${ap} ${h}시`;
  if (minute === 0) return `${base}쯤`;
  if (minute === 30) return `${base} 반쯤`;
  return `${base} ${minute}분쯤`;
}

// Last 7 calendar days ending today, oldest first. Returns YYYY-MM-DD strings.
export function lastSevenDays(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    out.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
  }
  return out;
}

// Current calendar week, Sunday→Saturday, as YYYY-MM-DD strings.
export function currentWeekSunToSat(): string[] {
  const sunday = dayjs().day(0); // Sunday of this week
  return Array.from({ length: 7 }, (_, i) =>
    sunday.add(i, 'day').format('YYYY-MM-DD')
  );
}
