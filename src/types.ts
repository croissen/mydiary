export type AiTone = 'casual' | 'literary' | 'concise' | 'custom';

export interface ResponseRow {
  id: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  timestamp: number; // Unix ms
  question_id: number;
  question_text: string;
  answer: string;
  skipped: number; // 0 | 1
}

export interface DiaryRow {
  id: number;
  date: string; // YYYY-MM-DD, UNIQUE
  compiled_at: number;
  content: string;
  tone: AiTone;
  user_edited: number; // 0 | 1
}

export interface QuietHours {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface AppSettings {
  notification_times: string[];
  // Per fixed-slot enable flag. false => no alarm at that time.
  slot_enabled: boolean[];
  // Per fixed-slot question. null => pick a random question for that slot.
  slot_questions: (string | null)[];
  // How many random extra alarms per day (0–5), within 09:00–22:00.
  random_extra_count: number;
  diary_compile_time: string;
  ai_tone: AiTone;
  // Free-form style instruction used when ai_tone === 'custom'.
  ai_custom_style: string;
  // Editable question pool (seeded from bundled questions, backed up).
  question_pool: Question[];
  quiet_hours: QuietHours;
  language: string;
  first_launch_completed: boolean;
  notification_permission_granted: boolean;
}

export type ReminderRepeat = 'once' | 'daily';

export interface NoteFolder {
  id: number;
  name: string;
  sort_order: number;
  created_at: number;
}

export interface Note {
  id: number;
  folder_id: number | null;
  // If set (YYYY-MM-DD), the note belongs to that calendar date and is shown
  // only in the calendar's date view (hidden from the Notes tab).
  note_date: string;
  title: string;
  content: string;
  favorite: number; // 0 | 1
  created_at: number;
  updated_at: number;
  reminder_enabled: number; // 0 | 1
  reminder_time: string; // HH:MM
  reminder_repeat: ReminderRepeat;
  reminder_at: number; // absolute fire time (ms) for 'once'; 0 for daily
  reminder_notif_id: string; // scheduled notification id ('' if none)
}

export interface Question {
  id: number;
  text: string;
  category: string;
  time_pref: 'any' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
}
