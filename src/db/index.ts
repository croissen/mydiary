import * as SQLite from 'expo-sqlite';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { AppSettings, DiaryRow, Note, NoteFolder, ResponseRow } from '../types';

const DB_NAME = 'mydiary.db';
const SCHEMA_VERSION = 1;

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  await migrate(dbInstance);
  return dbInstance;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      answer TEXT NOT NULL DEFAULT '',
      skipped INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_responses_date ON responses(date);

    CREATE TABLE IF NOT EXISTS diaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      compiled_at INTEGER NOT NULL,
      content TEXT NOT NULL,
      tone TEXT NOT NULL DEFAULT 'casual',
      user_edited INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER,
      note_date TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      reminder_enabled INTEGER NOT NULL DEFAULT 0,
      reminder_time TEXT NOT NULL DEFAULT '09:00',
      reminder_repeat TEXT NOT NULL DEFAULT 'once',
      reminder_at INTEGER NOT NULL DEFAULT 0,
      reminder_notif_id TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
  `);

  // Additive migrations: tables created by older versions won't have newer
  // columns (CREATE TABLE IF NOT EXISTS doesn't alter them), so add any that
  // are missing. This preserves existing rows — note_date defaults to ''.
  await ensureColumns(db, 'notes', [
    ['note_date', "TEXT NOT NULL DEFAULT ''"],
    ['reminder_enabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['reminder_time', "TEXT NOT NULL DEFAULT '09:00'"],
    ['reminder_repeat', "TEXT NOT NULL DEFAULT 'once'"],
    ['reminder_at', 'INTEGER NOT NULL DEFAULT 0'],
    ['reminder_notif_id', "TEXT NOT NULL DEFAULT ''"],
  ]);

  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    'schema_version'
  );
  if (!row) {
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      'schema_version',
      JSON.stringify(SCHEMA_VERSION)
    );
  }
}

async function ensureColumns(
  db: SQLite.SQLiteDatabase,
  table: string,
  cols: [name: string, def: string][]
): Promise<void> {
  const info = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`
  );
  const existing = new Set(info.map((c) => c.name));
  for (const [name, def] of cols) {
    if (!existing.has(name)) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
    }
  }
}

// ---------- Settings ----------

export async function getAllSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );
  const stored: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      stored[r.key] = JSON.parse(r.value);
    } catch {
      stored[r.key] = r.value;
    }
  }
  return { ...DEFAULT_SETTINGS, ...stored } as AppSettings;
}

export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K]> {
  const all = await getAllSettings();
  return all[key];
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    JSON.stringify(value)
  );
}

// Generic key/value access (used for non-typed caches like holidays).
export async function getKV(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setKV(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    value
  );
}

export async function setSettings(patch: Partial<AppSettings>): Promise<void> {
  for (const [k, v] of Object.entries(patch)) {
    await setSetting(k as keyof AppSettings, v as never);
  }
}

// ---------- Responses ----------

export async function addResponse(
  input: Omit<ResponseRow, 'id'>
): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO responses (date, time, timestamp, question_id, question_text, answer, skipped)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.date,
    input.time,
    input.timestamp,
    input.question_id,
    input.question_text,
    input.answer,
    input.skipped
  );
  return res.lastInsertRowId;
}

export async function getResponsesByDate(date: string): Promise<ResponseRow[]> {
  const db = await getDb();
  return db.getAllAsync<ResponseRow>(
    'SELECT * FROM responses WHERE date = ? ORDER BY timestamp ASC',
    date
  );
}

export async function getRecentQuestionIds(days: number): Promise<number[]> {
  const db = await getDb();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = await db.getAllAsync<{ question_id: number }>(
    'SELECT DISTINCT question_id FROM responses WHERE timestamp >= ?',
    cutoff
  );
  return rows.map((r) => r.question_id);
}

export async function getDatesWithData(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT date FROM responses
     UNION SELECT DISTINCT date FROM diaries
     ORDER BY date DESC`
  );
  return rows.map((r) => r.date);
}

// ---------- Diaries ----------

export async function upsertDiary(
  input: Omit<DiaryRow, 'id'>
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO diaries (date, compiled_at, content, tone, user_edited)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       compiled_at = excluded.compiled_at,
       content = excluded.content,
       tone = excluded.tone,
       user_edited = excluded.user_edited`,
    input.date,
    input.compiled_at,
    input.content,
    input.tone,
    input.user_edited
  );
}

export async function getDiaryByDate(date: string): Promise<DiaryRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DiaryRow>(
    'SELECT * FROM diaries WHERE date = ?',
    date
  );
  return row ?? null;
}

export async function getAllDiaries(): Promise<DiaryRow[]> {
  const db = await getDb();
  return db.getAllAsync<DiaryRow>('SELECT * FROM diaries ORDER BY date DESC');
}

export async function getDiaryDates(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM diaries'
  );
  return rows.map((r) => r.date);
}

// ---------- Note folders ----------

export async function getFolders(): Promise<NoteFolder[]> {
  const db = await getDb();
  return db.getAllAsync<NoteFolder>(
    'SELECT * FROM note_folders ORDER BY sort_order ASC, id ASC'
  );
}

export async function addFolder(name: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ m: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) AS m FROM note_folders'
  );
  const res = await db.runAsync(
    'INSERT INTO note_folders (name, sort_order, created_at) VALUES (?, ?, ?)',
    name,
    (row?.m ?? 0) + 1,
    Date.now()
  );
  return res.lastInsertRowId;
}

export async function renameFolder(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE note_folders SET name = ? WHERE id = ?', name, id);
}

export async function deleteFolder(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE notes SET folder_id = NULL WHERE folder_id = ?', id);
    await db.runAsync('DELETE FROM note_folders WHERE id = ?', id);
  });
}

// Move a folder up or down in the manual ordering by swapping with a neighbor.
export async function moveFolder(
  id: number,
  direction: 'up' | 'down'
): Promise<void> {
  const folders = await getFolders();
  const idx = folders.findIndex((f) => f.id === id);
  if (idx < 0) return;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= folders.length) return;
  const a = folders[idx];
  const b = folders[swapIdx];
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE note_folders SET sort_order = ? WHERE id = ?', b.sort_order, a.id);
    await db.runAsync('UPDATE note_folders SET sort_order = ? WHERE id = ?', a.sort_order, b.id);
  });
}

// ---------- Notes ----------

export interface NoteFilter {
  folderId?: number | null; // undefined = any; null = no folder
  favorite?: boolean;
  query?: string;
  general?: boolean; // only notes not tied to a calendar date (note_date = '')
  noteDate?: string; // only notes tied to this calendar date
}

export async function getNotes(filter: NoteFilter = {}): Promise<Note[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.favorite) where.push('favorite = 1');
  if (filter.general) where.push("note_date = ''");
  if (filter.noteDate) {
    where.push('note_date = ?');
    params.push(filter.noteDate);
  }
  if (filter.folderId === null) where.push('folder_id IS NULL');
  else if (typeof filter.folderId === 'number') {
    where.push('folder_id = ?');
    params.push(filter.folderId);
  }
  if (filter.query && filter.query.trim()) {
    where.push('(title LIKE ? OR content LIKE ?)');
    const q = `%${filter.query.trim()}%`;
    params.push(q, q);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db.getAllAsync<Note>(
    `SELECT * FROM notes ${clause} ORDER BY favorite DESC, updated_at DESC`,
    params
  );
}

export async function getNoteById(id: number): Promise<Note | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', id);
  return row ?? null;
}

export async function createNote(input: {
  title: string;
  content: string;
  folder_id: number | null;
  note_date?: string;
}): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const res = await db.runAsync(
    `INSERT INTO notes (folder_id, note_date, title, content, favorite, created_at, updated_at,
       reminder_enabled, reminder_time, reminder_repeat, reminder_at, reminder_notif_id)
     VALUES (?, ?, ?, ?, 0, ?, ?, 0, '09:00', 'once', 0, '')`,
    input.folder_id,
    input.note_date ?? '',
    input.title,
    input.content,
    now,
    now
  );
  return res.lastInsertRowId;
}

export async function updateNote(
  id: number,
  fields: Partial<
    Pick<
      Note,
      | 'title'
      | 'content'
      | 'folder_id'
      | 'favorite'
      | 'reminder_enabled'
      | 'reminder_time'
      | 'reminder_repeat'
      | 'reminder_at'
      | 'reminder_notif_id'
    >
  >
): Promise<void> {
  const db = await getDb();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map(
    (k) => (fields as Record<string, string | number | null>)[k]
  );
  await db.runAsync(
    `UPDATE notes SET ${sets}, updated_at = ? WHERE id = ?`,
    ...values,
    Date.now(),
    id
  );
}

export async function deleteNote(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function getNotesWithReminders(): Promise<Note[]> {
  const db = await getDb();
  return db.getAllAsync<Note>('SELECT * FROM notes WHERE reminder_enabled = 1');
}

// ---------- Backup / wipe ----------

export async function getAllResponses(): Promise<ResponseRow[]> {
  const db = await getDb();
  return db.getAllAsync<ResponseRow>(
    'SELECT * FROM responses ORDER BY timestamp ASC'
  );
}

export async function getRawSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function wipeAllData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM responses;
    DELETE FROM diaries;
    DELETE FROM settings;
    DELETE FROM notes;
    DELETE FROM note_folders;
  `);
}

export interface ImportPayload {
  responses: Omit<ResponseRow, 'id'>[];
  diaries: Omit<DiaryRow, 'id'>[];
  settings: Record<string, string>;
  folders?: NoteFolder[];
  notes?: (Omit<Note, 'id'> & { folder_id: number | null })[];
}

export async function importData(
  data: ImportPayload,
  mode: 'overwrite' | 'merge'
): Promise<void> {
  const { responses, diaries, settings, folders = [], notes = [] } = data;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    if (mode === 'overwrite') {
      await db.runAsync('DELETE FROM responses');
      await db.runAsync('DELETE FROM diaries');
      await db.runAsync('DELETE FROM notes');
      await db.runAsync('DELETE FROM note_folders');
    }
    for (const r of responses) {
      await db.runAsync(
        `INSERT INTO responses (date, time, timestamp, question_id, question_text, answer, skipped)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        r.date,
        r.time,
        r.timestamp,
        r.question_id,
        r.question_text,
        r.answer,
        r.skipped
      );
    }
    for (const d of diaries) {
      await db.runAsync(
        `INSERT INTO diaries (date, compiled_at, content, tone, user_edited)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           compiled_at = excluded.compiled_at,
           content = excluded.content,
           tone = excluded.tone,
           user_edited = excluded.user_edited`,
        d.date,
        d.compiled_at,
        d.content,
        d.tone,
        d.user_edited
      );
    }
    for (const [k, v] of Object.entries(settings)) {
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        k,
        v
      );
    }
    // Folders get fresh ids; remap note.folder_id through this map.
    const folderIdMap = new Map<number, number>();
    for (const f of folders) {
      const res = await db.runAsync(
        'INSERT INTO note_folders (name, sort_order, created_at) VALUES (?, ?, ?)',
        f.name,
        f.sort_order,
        f.created_at
      );
      folderIdMap.set(f.id, res.lastInsertRowId);
    }
    for (const n of notes) {
      const mapped =
        n.folder_id != null ? folderIdMap.get(n.folder_id) ?? null : null;
      await db.runAsync(
        `INSERT INTO notes (folder_id, note_date, title, content, favorite, created_at, updated_at,
           reminder_enabled, reminder_time, reminder_repeat, reminder_at, reminder_notif_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`,
        mapped,
        n.note_date ?? '',
        n.title,
        n.content,
        n.favorite,
        n.created_at,
        n.updated_at,
        n.reminder_enabled,
        n.reminder_time,
        n.reminder_repeat,
        n.reminder_at ?? 0
      );
    }
  });
}
