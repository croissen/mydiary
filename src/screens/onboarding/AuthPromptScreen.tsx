import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../state/SettingsContext';
import { getAllSettings } from '../../db';
import { rescheduleAll } from '../../notifications';
import { colors, font, radius, spacing } from '../../theme';

type SheetMode = null | 'signup-trial' | 'signup-free' | 'login';
type SignupStep = 'form' | 'otp' | 'done';
type ForgotStep = null | 'email' | 'otp' | 'newpw' | 'done';

export function AuthPromptScreen() {
  const { t } = useTranslation('onboarding');
  const {
    signIn, signUp, signInWithGoogle,
    startTrial, verifyEmailOtp,
    sendPasswordResetOtp, verifyPasswordResetOtp, updatePassword,
  } = useAuth();
  const { update } = useSettings();

  const [mode, setMode] = useState<SheetMode>(null);
  const [signupStep, setSignupStep] = useState<SignupStep>('form');
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [otp, setOtp] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    await update({ first_launch_completed: true });
    const fresh = await getAllSettings();
    await rescheduleAll(fresh);
  };

  const openSheet = (m: SheetMode) => {
    setMode(m);
    setSignupStep('form');
    setForgotStep(null);
    setEmail(''); setPw(''); setOtp('');
    setForgotEmail(''); setForgotOtp('');
    setNewPw(''); setConfirmPw('');
    setErr('');
  };

  const isSignup = mode === 'signup-trial' || mode === 'signup-free';
  const isTrial = mode === 'signup-trial';

  // ── 회원가입: 이메일/비밀번호 제출 ──
  const handleSignup = async () => {
    if (!email.trim() || !pw.trim()) {
      setErr('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true); setErr('');
    try {
      const result = await signUp(email.trim(), pw);
      if (result === 'needs_verification') {
        setSignupStep('otp');
      } else {
        // Supabase 이메일 인증 비활성화 시 바로 완료
        if (isTrial) await startTrial();
        await finish();
      }
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? '오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  // ── 회원가입: OTP 인증 ──
  const handleSignupOtp = async () => {
    if (!otp.trim()) { setErr('인증번호를 입력해 주세요.'); return; }
    setBusy(true); setErr('');
    try {
      await verifyEmailOtp(email.trim(), otp.trim());
      if (isTrial) await startTrial();
      setSignupStep('done');
      setTimeout(finish, 1500);
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? '인증번호가 올바르지 않아요.');
    } finally {
      setBusy(false);
    }
  };

  // ── 로그인 ──
  const handleLogin = async () => {
    if (!email.trim() || !pw.trim()) {
      setErr('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true); setErr('');
    try {
      await signIn(email.trim(), pw);
      await finish();
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? '이메일 또는 비밀번호를 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  // ── Google 로그인 ──
  const handleGoogle = async () => {
    setBusy(true); setErr('');
    try {
      await signInWithGoogle();
      if (isTrial) await startTrial();
      await finish();
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? 'Google 로그인에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  // ── 비밀번호 찾기: OTP 전송 ──
  const handleForgotSend = async () => {
    if (!forgotEmail.trim()) { setErr('이메일을 입력해 주세요.'); return; }
    setBusy(true); setErr('');
    try {
      await sendPasswordResetOtp(forgotEmail.trim());
      setForgotStep('otp');
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? '전송에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  // ── 비밀번호 찾기: OTP 인증 ──
  const handleForgotOtp = async () => {
    if (!forgotOtp.trim()) { setErr('인증번호를 입력해 주세요.'); return; }
    setBusy(true); setErr('');
    try {
      await verifyPasswordResetOtp(forgotEmail.trim(), forgotOtp.trim());
      setForgotStep('newpw');
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? '인증번호가 올바르지 않아요.');
    } finally {
      setBusy(false);
    }
  };

  // ── 비밀번호 변경 ──
  const handleNewPw = async () => {
    if (!newPw || !confirmPw) { setErr('비밀번호를 입력해 주세요.'); return; }
    if (newPw !== confirmPw) { setErr('비밀번호가 일치하지 않아요.'); return; }
    if (newPw.length < 6) { setErr('비밀번호는 6자 이상이어야 해요.'); return; }
    setBusy(true); setErr('');
    try {
      await updatePassword(newPw);
      setForgotStep('done');
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? '변경에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  // Sheet 타이틀
  const sheetTitle = isSignup ? '회원가입'
    : forgotStep === null ? '로그인'
    : forgotStep === 'email' ? '비밀번호 재설정'
    : forgotStep === 'otp' ? '인증번호 확인'
    : forgotStep === 'newpw' ? '새 비밀번호 설정'
    : '완료';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.emoji}>✨</Text>
        <Text style={styles.title}>{t('auth.title')}</Text>
        <Text style={styles.line}>{t('auth.line1')}</Text>
        <Text style={styles.line}>{t('auth.line2')}</Text>
        <Text style={styles.note}>{t('auth.note')}</Text>
      </View>
      <View style={styles.footer}>
        <Button title={t('auth.startTrial')} onPress={() => openSheet('signup-trial')} />
        <Button
          title={t('auth.hasAccount')}
          variant="secondary"
          onPress={() => openSheet('login')}
          style={{ marginTop: spacing.sm }}
        />
        <Button
          title={t('auth.later')}
          variant="ghost"
          onPress={() => openSheet('signup-free')}
          style={{ marginTop: spacing.xs }}
        />
      </View>

      <Sheet visible={mode !== null} title={sheetTitle} onClose={() => setMode(null)}>
        {/* ── 회원가입: 이메일/비밀번호 폼 ── */}
        {isSignup && signupStep === 'form' && (
          <>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="이메일"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <TextInput
              style={[styles.input, { marginTop: spacing.sm }]}
              value={pw}
              onChangeText={setPw}
              placeholder="비밀번호"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            {!!err && <Text style={styles.err}>{err}</Text>}
            <Button title="가입하기" onPress={handleSignup} loading={busy} style={{ marginTop: spacing.md }} />
            <View style={styles.divRow}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>또는</Text>
              <View style={styles.divLine} />
            </View>
            <Button title="Google로 계속하기" variant="secondary" onPress={handleGoogle} loading={busy} />
          </>
        )}

        {/* ── 회원가입: OTP 입력 ── */}
        {isSignup && signupStep === 'otp' && (
          <>
            <Text style={styles.otpTitle}>인증번호가 전송되었습니다.</Text>
            <Text style={styles.otpSub}>{email}로 전송된 6자리 인증번호를 입력해 주세요.</Text>
            <View style={styles.otpRow}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={otp}
                onChangeText={setOtp}
                placeholder="인증번호 6자리"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <Pressable
                onPress={handleSignupOtp}
                disabled={busy}
                style={[styles.verifyBtn, busy && styles.verifyBtnDim]}
              >
                <Text style={styles.verifyBtnText}>인증</Text>
              </Pressable>
            </View>
            {!!err && <Text style={styles.err}>{err}</Text>}
          </>
        )}

        {/* ── 회원가입: 완료 ── */}
        {isSignup && signupStep === 'done' && (
          <View style={styles.doneBox}>
            <Text style={styles.doneEmoji}>🎉</Text>
            <Text style={styles.doneText}>회원가입이 완료되었습니다!</Text>
          </View>
        )}

        {/* ── 로그인: 폼 ── */}
        {mode === 'login' && forgotStep === null && (
          <>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="이메일"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <TextInput
              style={[styles.input, { marginTop: spacing.sm }]}
              value={pw}
              onChangeText={setPw}
              placeholder="비밀번호"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            {!!err && <Text style={styles.err}>{err}</Text>}
            <Button title="로그인" onPress={handleLogin} loading={busy} style={{ marginTop: spacing.md }} />
            <View style={styles.divRow}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>또는</Text>
              <View style={styles.divLine} />
            </View>
            <Button title="Google로 계속하기" variant="secondary" onPress={handleGoogle} loading={busy} />
            <Pressable
              onPress={() => { setForgotEmail(''); setForgotStep('email'); setErr(''); }}
              style={styles.forgotRow}
            >
              <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
            </Pressable>
          </>
        )}

        {/* ── 비밀번호 찾기: 이메일 입력 ── */}
        {mode === 'login' && forgotStep === 'email' && (
          <>
            <TextInput
              style={styles.input}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              placeholder="가입한 이메일"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            {!!err && <Text style={styles.err}>{err}</Text>}
            <Button title="인증번호 전송" onPress={handleForgotSend} loading={busy} style={{ marginTop: spacing.md }} />
            <Pressable onPress={() => { setForgotStep(null); setErr(''); }} style={styles.backRow}>
              <Text style={styles.backText}>← 로그인으로 돌아가기</Text>
            </Pressable>
          </>
        )}

        {/* ── 비밀번호 찾기: OTP 입력 ── */}
        {mode === 'login' && forgotStep === 'otp' && (
          <>
            <Text style={styles.otpTitle}>인증번호가 발송되었습니다.</Text>
            <Text style={styles.otpSub}>{forgotEmail}로 전송된 6자리 인증번호를 입력해 주세요.</Text>
            <View style={styles.otpRow}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={forgotOtp}
                onChangeText={setForgotOtp}
                placeholder="인증번호 6자리"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <Pressable
                onPress={handleForgotOtp}
                disabled={busy}
                style={[styles.verifyBtn, busy && styles.verifyBtnDim]}
              >
                <Text style={styles.verifyBtnText}>인증</Text>
              </Pressable>
            </View>
            {!!err && <Text style={styles.err}>{err}</Text>}
          </>
        )}

        {/* ── 비밀번호 찾기: 새 비밀번호 ── */}
        {mode === 'login' && forgotStep === 'newpw' && (
          <>
            <TextInput
              style={styles.input}
              value={newPw}
              onChangeText={setNewPw}
              placeholder="새 비밀번호"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={[styles.input, { marginTop: spacing.sm }]}
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder="비밀번호 확인"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            {!!err && <Text style={styles.err}>{err}</Text>}
            <Button title="변경하기" onPress={handleNewPw} loading={busy} style={{ marginTop: spacing.md }} />
          </>
        )}

        {/* ── 비밀번호 변경 완료 ── */}
        {mode === 'login' && forgotStep === 'done' && (
          <>
            <View style={styles.doneBox}>
              <Text style={styles.doneEmoji}>✅</Text>
              <Text style={styles.doneText}>비밀번호가 변경되었습니다.</Text>
            </View>
            <Button
              title="로그인하기"
              onPress={() => {
                setPw(''); setForgotStep(null); setErr('');
              }}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emoji: { fontSize: 56, marginBottom: spacing.lg },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: spacing.lg,
  },
  line: {
    fontSize: font.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  note: {
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footer: { padding: spacing.lg },
  flex: { flex: 1 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  err: { fontSize: font.small, color: colors.warning, marginTop: spacing.sm },
  divRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divText: { fontSize: font.small, color: colors.textMuted },
  otpTitle: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  otpSub: {
    fontSize: font.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  otpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  verifyBtnDim: { opacity: 0.6 },
  verifyBtnText: { color: colors.white, fontWeight: '700', fontSize: font.body },
  doneBox: { alignItems: 'center', paddingVertical: spacing.xl },
  doneEmoji: { fontSize: 48, marginBottom: spacing.md },
  doneText: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  forgotRow: { alignItems: 'flex-end', marginTop: spacing.md },
  forgotText: {
    fontSize: font.small,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  backRow: { alignItems: 'center', marginTop: spacing.md },
  backText: { fontSize: font.small, color: colors.textSecondary },
});
