import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { AppSettings } from '../types';
import { hmToMinutes, isInQuietHours, minutesToHM, nowTimeStr, parseHM, todayStr } from '../utils/date';
import { pickQuestion } from '../data/questionPicker';
import { addResponse, getNotesWithReminders, updateNote } from '../db';

const CHANNEL_ID = 'reminders';
const CATEGORY_ID = 'diary_reply';
export const REPLY_ACTION = 'REPLY';
export const SNOOZE_ACTION = 'SNOOZE';
const SNOOZE_MINUTES = 10;

export interface SlotData {
  slotIndex: number;
  kind: 'fixed' | 'random' | 'snooze';
  question: string;
  questionId: number;
  [key: string]: unknown;
}

// Register the notification action buttons: an inline text reply and a
// "ask again in 10 min" snooze. Idempotent — safe to call on every launch.
export async function ensureCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: REPLY_ACTION,
      buttonTitle: '답장',
      textInput: {
        submitButtonTitle: '전송',
        placeholder: '한 줄 남기기...',
      },
      // Bring the app up so the reply is always saved and the shade spinner
      // clears — opensAppToForeground:false leaves it stuck when the app is
      // killed in the background.
      options: { opensAppToForeground: true },
    },
    {
      identifier: SNOOZE_ACTION,
      buttonTitle: `${SNOOZE_MINUTES}분 뒤 다시`,
      options: { opensAppToForeground: false },
    },
  ]);
}

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '일기 질문 알림',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#4A6FA5',
  });
}

export async function getPermissionStatus(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function requestPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    // Emulators may not deliver notifications, but allow flow to continue.
    return true;
  }
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}

// Build notification content with a concrete question embedded, so the user
// can reply inline from the shade. Custom slot questions win; otherwise pick
// one suited to the given hour.
async function buildContent(
  slotIndex: number,
  kind: SlotData['kind'],
  hour: number,
  customQuestion: string | null
): Promise<Notifications.NotificationContentInput> {
  let questionText: string;
  let questionId: number;
  const custom = customQuestion && customQuestion.trim().length > 0
    ? customQuestion.trim()
    : null;
  if (custom) {
    questionText = custom;
    questionId = 0;
  } else {
    const at = new Date();
    at.setHours(hour, 0, 0, 0);
    const q = await pickQuestion(at);
    questionText = q.text;
    questionId = q.id;
  }
  return {
    title: '오늘의 한 줄',
    body: questionText,
    data: { slotIndex, kind, question: questionText, questionId } as SlotData,
    categoryIdentifier: CATEGORY_ID,
  };
}

async function scheduleFixed(
  hm: string,
  slotIndex: number,
  question: string | null
): Promise<void> {
  const { hour, minute } = parseHM(hm);
  const content = await buildContent(slotIndex, 'fixed', hour, question);
  await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}

const RANDOM_START_MIN = 9 * 60; // 09:00
const RANDOM_END_MIN = 22 * 60; // 22:00

// Random extra alarms (0–5) land between 09:00–22:00, avoiding the fixed
// times and the quiet-hours window. Each is scheduled for its next occurrence
// within the coming 24h.
async function scheduleRandomForNext24h(
  settings: AppSettings,
  baseSlot: number
): Promise<void> {
  const count = Math.max(0, Math.min(5, settings.random_extra_count));
  if (count === 0) return;

  // Fixed times to avoid (enabled slots only), in minute-of-day.
  const fixedMins = settings.notification_times
    .filter((_, i) => settings.slot_enabled?.[i] !== false)
    .map((hm) => hmToMinutes(hm));

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const chosenMins: number[] = [];
  const minGap = 60;
  let attempts = 0;

  while (chosenMins.length < count && attempts < 400) {
    attempts++;
    const m =
      RANDOM_START_MIN +
      Math.floor(Math.random() * (RANDOM_END_MIN - RANDOM_START_MIN));
    const hm = minutesToHM(m);
    if (isInQuietHours(hm, settings.quiet_hours.start, settings.quiet_hours.end)) {
      continue;
    }
    if (fixedMins.some((fm) => Math.abs(fm - m) < 30)) continue;
    if (chosenMins.some((cm) => Math.abs(cm - m) < minGap)) continue;
    chosenMins.push(m);
  }

  for (let i = 0; i < chosenMins.length; i++) {
    const m = chosenMins[i];
    const t = new Date(now);
    t.setHours(Math.floor(m / 60), m % 60, 0, 0);
    // If that time already passed today, schedule for tomorrow.
    if (m <= nowMin) t.setDate(t.getDate() + 1);

    const content = await buildContent(
      baseSlot + i,
      'random',
      Math.floor(m / 60),
      null
    );
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: t,
        channelId: CHANNEL_ID,
      },
    });
  }
}

// Compute the next occurrence (today or tomorrow) of an HH:MM time, in ms.
export function nextOccurrenceMs(hm: string): number {
  const { hour, minute } = parseHM(hm);
  const t = new Date();
  t.setHours(hour, minute, 0, 0);
  if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
  return t.getTime();
}

// Cancel only note reminders (leaves diary/question notifications intact), then
// reschedule every enabled note. Called on note changes and full reschedules.
export async function scheduleAllNoteReminders(): Promise<void> {
  await ensureAndroidChannel();
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    const kind = (n.content.data as { kind?: string } | undefined)?.kind;
    if (kind === 'note') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const notes = await getNotesWithReminders();
  for (const note of notes) {
    const content = {
      title: '📝 노트 알림',
      body: note.title.trim() || '메모를 확인해보세요',
      data: { kind: 'note', noteId: note.id },
    };
    if (note.reminder_repeat === 'daily') {
      const { hour, minute } = parseHM(note.reminder_time);
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: CHANNEL_ID,
        },
      });
    } else {
      // one-time: fire only if its target is still in the future.
      if (note.reminder_at > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(note.reminder_at),
            channelId: CHANNEL_ID,
          },
        });
      } else {
        // Already fired — turn the reminder off so the UI stays honest.
        await updateNote(note.id, { reminder_enabled: 0 });
      }
    }
  }
}

// Daily "your diary is ready" reminder at the compile time. Tapping it opens
// the app, which generates today's diary if it isn't done yet.
async function scheduleCompileNotification(time: string): Promise<void> {
  const { hour, minute } = parseHM(time);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '오늘의 일기가 도착했어요 📔',
      body: '탭해서 오늘 하루를 확인해보세요.',
      data: { kind: 'compile' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}

// Re-ask the same question after the snooze interval.
async function snooze(data: SlotData): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '오늘의 한 줄',
      body: data.question || '지금 어때요?',
      data: { ...data, kind: 'snooze' } as SlotData,
      categoryIdentifier: CATEGORY_ID,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: SNOOZE_MINUTES * 60,
      channelId: CHANNEL_ID,
    },
  });
}

const processed = new Set<string>();

export interface ResponseOutcome {
  handled: boolean; // true = already acted on (reply saved / snoozed)
  compile?: boolean; // tapped the daily compile reminder
  noteId?: number; // tapped a note reminder
  question?: string;
  questionId?: number;
}

async function dismiss(id: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(id);
  } catch {
    // ignore — notification may already be gone
  }
}

// Central handler for a tapped notification or one of its action buttons.
// REPLY (inline text) saves the answer directly; SNOOZE re-schedules; a plain
// tap is left for the caller to open the in-app answer screen.
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<ResponseOutcome> {
  const data = (response.notification.request.content.data ?? {}) as Record<
    string,
    unknown
  >;
  const kind = typeof data.kind === 'string' ? data.kind : '';
  const question = typeof data.question === 'string' ? data.question : undefined;
  const questionId = typeof data.questionId === 'number' ? data.questionId : 0;
  const id = response.notification.request.identifier;
  const action = response.actionIdentifier;
  const userText = response.userText ?? '';
  const dedupKey = `${id}|${action}|${userText}`;
  if (processed.has(dedupKey)) return { handled: true };
  processed.add(dedupKey);

  if (action === SNOOZE_ACTION) {
    await snooze(data as unknown as SlotData);
    await dismiss(id);
    return { handled: true };
  }

  if (action === REPLY_ACTION && userText.trim().length > 0) {
    await addResponse({
      date: todayStr(),
      time: nowTimeStr(),
      timestamp: Date.now(),
      question_id: questionId,
      question_text: question ?? '',
      answer: userText.trim(),
      skipped: 0,
    });
    // Clear the inline-reply spinner / remove the notification.
    await dismiss(id);
    return { handled: true };
  }

  // Plain tap of the daily compile reminder.
  if (kind === 'compile') {
    return { handled: false, compile: true };
  }

  // Plain tap of a note reminder.
  if (kind === 'note') {
    const noteId = typeof data.noteId === 'number' ? data.noteId : undefined;
    return { handled: false, noteId };
  }

  // Plain tap (DEFAULT_ACTION) — caller opens the answer screen.
  return { handled: false, question, questionId };
}

// Cancel everything and rebuild the full schedule. Safe to call on every app
// open; this is also how random notifications get refreshed for the next 24h.
export async function rescheduleAll(settings: AppSettings): Promise<void> {
  await ensureAndroidChannel();
  await ensureCategory();
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.notification_permission_granted) return;

  const times = settings.notification_times;
  const slotQ = settings.slot_questions ?? [];
  const slotOn = settings.slot_enabled ?? [];
  for (let i = 0; i < times.length; i++) {
    if (slotOn[i] === false) continue; // disabled slot: no alarm
    await scheduleFixed(times[i], i, slotQ[i] ?? null);
  }
  await scheduleRandomForNext24h(settings, times.length);
  await scheduleCompileNotification(settings.diary_compile_time);
  await scheduleAllNoteReminders();
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
