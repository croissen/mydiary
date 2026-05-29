import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import CryptoJS from 'crypto-js';
import dayjs from 'dayjs';
import {
  getAllResponses,
  getAllDiaries,
  getRawSettings,
  getFolders,
  getNotes,
} from '../db';
import { DiaryRow, Note, NoteFolder, ResponseRow } from '../types';

const APP_ID = 'mydiary';
const SCHEMA_VERSION = 2;

interface BackupPayload {
  app_id: string;
  schema_version: number;
  exported_at: string;
  settings: Record<string, string>;
  responses: Omit<ResponseRow, 'id'>[];
  diaries: Omit<DiaryRow, 'id'>[];
  folders: NoteFolder[];
  notes: Omit<Note, 'id'>[];
}

interface FileEnvelope {
  app_id: string;
  schema_version: number;
  exported_at: string;
  encrypted: boolean;
  cipher?: string;
  payload?: BackupPayload;
}

function strip<T extends { id: number }>(rows: T[]): Omit<T, 'id'>[] {
  return rows.map(({ id, ...rest }) => rest);
}

async function buildPayload(): Promise<BackupPayload> {
  const [responses, diaries, settings, folders, notes] = await Promise.all([
    getAllResponses(),
    getAllDiaries(),
    getRawSettings(),
    getFolders(),
    getNotes(),
  ]);
  return {
    app_id: APP_ID,
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    settings,
    responses: strip(responses),
    diaries: strip(diaries),
    folders,
    notes: strip(notes),
  };
}

export async function exportBackup(password?: string): Promise<void> {
  const payload = await buildPayload();
  const stamp = dayjs().format('YYYYMMDD');

  let contents: string;
  let filename: string;

  if (password && password.length > 0) {
    const cipher = CryptoJS.AES.encrypt(
      JSON.stringify(payload),
      password
    ).toString();
    const envelope: FileEnvelope = {
      app_id: APP_ID,
      schema_version: SCHEMA_VERSION,
      exported_at: payload.exported_at,
      encrypted: true,
      cipher,
    };
    contents = JSON.stringify(envelope);
    filename = `mydiary_backup_${stamp}.mydiary`;
  } else {
    const envelope: FileEnvelope = {
      app_id: APP_ID,
      schema_version: SCHEMA_VERSION,
      exported_at: payload.exported_at,
      encrypted: false,
      payload,
    };
    contents = JSON.stringify(envelope, null, 2);
    filename = `mydiary_backup_${stamp}.json`;
  }

  const file = new File(Paths.cache, filename);
  try {
    file.create({ overwrite: true });
  } catch {
    // create may throw if it already exists on some platforms; ignore.
  }
  file.write(contents);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: '백업 파일 저장',
    });
  }
}

export interface PickedBackup {
  encrypted: boolean;
  raw: string; // file contents
}

export async function pickBackupFile(): Promise<PickedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: ['application/json', 'application/octet-stream', '*/*'],
  });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;

  const uri = res.assets[0].uri;
  const file = new File(uri);
  const raw = await file.text();

  let envelope: FileEnvelope;
  try {
    envelope = JSON.parse(raw) as FileEnvelope;
  } catch {
    throw new Error('INVALID_FILE');
  }
  if (envelope.app_id !== APP_ID) {
    throw new Error('INVALID_FILE');
  }
  return { encrypted: !!envelope.encrypted, raw };
}

export function parseBackup(raw: string, password?: string): BackupPayload {
  let envelope: FileEnvelope;
  try {
    envelope = JSON.parse(raw) as FileEnvelope;
  } catch {
    throw new Error('INVALID_FILE');
  }

  if (envelope.encrypted) {
    if (!password) throw new Error('PASSWORD_REQUIRED');
    let decrypted: string;
    try {
      const bytes = CryptoJS.AES.decrypt(envelope.cipher ?? '', password);
      decrypted = bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      throw new Error('WRONG_PASSWORD');
    }
    if (!decrypted) throw new Error('WRONG_PASSWORD');
    try {
      const payload = JSON.parse(decrypted) as BackupPayload;
      validatePayload(payload);
      return payload;
    } catch {
      throw new Error('WRONG_PASSWORD');
    }
  }

  if (!envelope.payload) throw new Error('INVALID_FILE');
  validatePayload(envelope.payload);
  return envelope.payload;
}

function validatePayload(p: BackupPayload): void {
  if (
    !p ||
    p.app_id !== APP_ID ||
    typeof p.schema_version !== 'number' ||
    !Array.isArray(p.responses) ||
    !Array.isArray(p.diaries)
  ) {
    throw new Error('INVALID_FILE');
  }
  if (p.schema_version > SCHEMA_VERSION) {
    throw new Error('SCHEMA_TOO_NEW');
  }
}

export type { BackupPayload };
