import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Supabase 프로젝트 대시보드 → Settings → API 에서 복사
// supabase.com 에서 프로젝트 만든 뒤 채워주세요.
export const SUPABASE_URL = 'https://gxthvkejtnqdntsbktcf.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_En1vQDM_uGI4gd82brqvfQ_1BlmgnDA';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const BUCKET = 'backups';

export async function uploadBackup(userId: string, json: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${userId}/latest.json`, json, {
      contentType: 'application/json',
      upsert: true,
    });
  if (error) throw error;
}

export async function downloadBackup(userId: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${userId}/latest.json`);
  if (error) {
    if (
      error.message?.toLowerCase().includes('not found') ||
      (error as unknown as { statusCode?: string }).statusCode === '404'
    ) {
      return null;
    }
    throw error;
  }
  return data.text();
}
