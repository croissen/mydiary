import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { supabase, uploadBackup, downloadBackup } from './supabaseClient';

WebBrowser.maybeCompleteAuthSession();
import {
  getAllResponses,
  getAllDiaries,
  getRawSettings,
  getFolders,
  getNotes,
  importData,
} from '../db';

const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

function calcTrialDaysLeft(startedAt: number): number {
  const remaining = TRIAL_MS - (Date.now() - startedAt);
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

export interface AuthState {
  user: User | null;
  initialized: boolean;
  canUseAI: boolean;
  trialDaysLeft: number;
  trialStarted: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<'confirmed' | 'needs_verification'>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  startTrial: () => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  sendPasswordResetOtp: (email: string) => Promise<void>;
  verifyPasswordResetOtp: (email: string, token: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  syncToCloud: () => Promise<void>;
  restoreFromCloud: () => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setInitialized(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const trialStarted = !!(user?.user_metadata?.trial_started_at);

  const trialDaysLeft = useMemo(() => {
    if (!user) return 0;
    const startedAt = user.user_metadata?.trial_started_at as number | undefined;
    if (!startedAt) return 0;
    return calcTrialDaysLeft(startedAt);
  }, [user]);

  const canUseAI = !!user && trialDaysLeft > 0;

  const buildJson = useCallback(async (): Promise<string> => {
    const [responses, diaries, settings, folders, notes] = await Promise.all([
      getAllResponses(),
      getAllDiaries(),
      getRawSettings(),
      getFolders(),
      getNotes(),
    ]);
    return JSON.stringify({
      app_id: 'mydiary',
      schema_version: 2,
      exported_at: new Date().toISOString(),
      settings,
      responses: responses.map(({ id: _id, ...r }) => r),
      diaries: diaries.map(({ id: _id, ...d }) => d),
      folders,
      notes: notes.map(({ id: _id, ...n }) => n),
    });
  }, []);

  const syncToCloud = useCallback(async (): Promise<void> => {
    if (!user) throw new Error('NOT_LOGGED_IN');
    await uploadBackup(user.id, await buildJson());
  }, [user, buildJson]);

  const restoreFromCloud = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const json = await downloadBackup(user.id);
    if (!json) return false;
    const pl = JSON.parse(json) as {
      responses?: unknown[];
      diaries?: unknown[];
      settings?: Record<string, string>;
      folders?: unknown[];
      notes?: unknown[];
    };
    await importData(
      {
        responses: (pl.responses ?? []) as never,
        diaries: (pl.diaries ?? []) as never,
        settings: pl.settings ?? {},
        folders: (pl.folders ?? []) as never,
        notes: (pl.notes ?? []) as never,
      },
      'overwrite'
    );
    return true;
  }, [user]);

  // Cloud sync on login (returning users)
  const handlePostLogin = useCallback(
    async (u: User) => {
      try {
        const responses = await getAllResponses();
        if (responses.length === 0) {
          await restoreFromCloud();
        } else {
          await uploadBackup(u.id, await buildJson());
        }
      } catch {
        // 동기화 실패는 로그인을 막지 않음
      }
    },
    [restoreFromCloud, buildJson]
  );

  // Explicitly start 7-day trial (idempotent — can only start once)
  const startTrial = useCallback(async (): Promise<void> => {
    const { data } = await supabase.auth.getUser();
    if (data.user?.user_metadata?.trial_started_at) return;
    await supabase.auth.updateUser({ data: { trial_started_at: Date.now() } });
  }, []);

  // Verify signup OTP sent to email
  const verifyEmailOtp = useCallback(async (email: string, token: string): Promise<void> => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) throw error;
    // user state updates via onAuthStateChange
  }, []);

  // Send password-reset OTP to email
  const sendPasswordResetOtp = useCallback(async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }, []);

  // Verify password-reset OTP (establishes session for updatePassword)
  const verifyPasswordResetOtp = useCallback(async (email: string, token: string): Promise<void> => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    if (error) throw error;
  }, []);

  // Update password (call after verifyPasswordResetOtp)
  const updatePassword = useCallback(async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data.user) await handlePostLogin(data.user);
    },
    [handlePostLogin]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string
    ): Promise<'confirmed' | 'needs_verification'> => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session?.user) {
        // 이메일 인증 없이 바로 가입 완료 (Supabase 설정에서 인증 비활성화 시)
        return 'confirmed';
      }
      return 'needs_verification';
    },
    []
  );

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    const redirectUri = 'mydiary://auth/callback';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUri, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL');

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (res.type !== 'success') return;

    const url = new URL(res.url);
    const code = url.searchParams.get('code');
    if (code) {
      const { data: sd, error: se } = await supabase.auth.exchangeCodeForSession(code);
      if (se) throw se;
      if (sd.user) await handlePostLogin(sd.user);
      return;
    }
    const hash = new URLSearchParams(url.hash.substring(1));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if (access_token && refresh_token) {
      const { data: sd, error: se } = await supabase.auth.setSession({ access_token, refresh_token });
      if (se) throw se;
      if (sd.user) await handlePostLogin(sd.user);
    }
  }, [handlePostLogin]);

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
  }, []);

  const updateDisplayName = useCallback(async (name: string): Promise<void> => {
    await supabase.auth.updateUser({ data: { full_name: name } });
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
  }, []);

  const deleteAccount = useCallback(async (): Promise<void> => {
    const { wipeAllData } = await import('../db');
    await wipeAllData();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      user,
      initialized,
      canUseAI,
      trialDaysLeft,
      trialStarted,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      startTrial,
      verifyEmailOtp,
      sendPasswordResetOtp,
      verifyPasswordResetOtp,
      updatePassword,
      updateDisplayName,
      deleteAccount,
      syncToCloud,
      restoreFromCloud,
    }),
    [
      user,
      initialized,
      canUseAI,
      trialDaysLeft,
      trialStarted,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      startTrial,
      verifyEmailOtp,
      sendPasswordResetOtp,
      verifyPasswordResetOtp,
      updatePassword,
      updateDisplayName,
      deleteAccount,
      syncToCloud,
      restoreFromCloud,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
