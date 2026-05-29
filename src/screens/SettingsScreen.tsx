import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { TimePickerField } from '../components/TimePickerField';
import { exportBackup, parseBackup, pickBackupFile } from '../backup';
import { getAllSettings, importData, wipeAllData } from '../db';
import { rescheduleAll } from '../notifications';
import { useSettings } from '../state/SettingsContext';
import { BUNDLED_QUESTIONS } from '../settings/defaults';
import { colors, font, radius, spacing } from '../theme';
import { AiTone, Question } from '../types';

const TONES: AiTone[] = ['casual', 'literary', 'concise', 'custom'];

export function SettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);
  const { settings, update, reload } = useSettings();

  const [notifSheet, setNotifSheet] = useState(false);
  const [randomSheet, setRandomSheet] = useState(false);
  const [questionsSheet, setQuestionsSheet] = useState(false);
  const [quietSheet, setQuietSheet] = useState(false);
  const [backupSheet, setBackupSheet] = useState(false);
  const [restorePwSheet, setRestorePwSheet] = useState(false);
  const [infoSheet, setInfoSheet] = useState<null | 'privacy' | 'data'>(null);

  // Editable copies for sheets.
  const [times, setTimes] = useState(settings.notification_times);
  const [slotOn, setSlotOn] = useState<boolean[]>(
    settings.notification_times.map((_, i) => settings.slot_enabled?.[i] !== false)
  );
  const [slotQ, setSlotQ] = useState<string[]>(
    settings.notification_times.map((_, i) => settings.slot_questions?.[i] ?? '')
  );
  const [randomCount, setRandomCount] = useState(settings.random_extra_count);
  const [quietStart, setQuietStart] = useState(settings.quiet_hours.start);
  const [quietEnd, setQuietEnd] = useState(settings.quiet_hours.end);
  const [customStyle, setCustomStyle] = useState(settings.ai_custom_style);
  const [questions, setQuestions] = useState<Question[]>(settings.question_pool);
  const [newQuestion, setNewQuestion] = useState('');
  const [backupPw, setBackupPw] = useState('');
  const [restorePw, setRestorePw] = useState('');
  const [pendingRaw, setPendingRaw] = useState('');
  const [busy, setBusy] = useState(false);

  const enabledFixed = (settings.slot_enabled ?? []).filter(
    (v, i) => v !== false && i < settings.notification_times.length
  ).length;

  // ----- Notification times -----
  const openNotif = () => {
    setTimes(settings.notification_times);
    setSlotOn(settings.notification_times.map((_, i) => settings.slot_enabled?.[i] !== false));
    setSlotQ(settings.notification_times.map((_, i) => settings.slot_questions?.[i] ?? ''));
    setNotifSheet(true);
  };
  const saveNotif = async () => {
    await update({
      notification_times: times,
      slot_enabled: slotOn,
      slot_questions: slotQ.map((q) => (q.trim() ? q.trim() : null)),
    });
    setNotifSheet(false);
  };

  // ----- Random -----
  const openRandom = () => {
    setRandomCount(settings.random_extra_count);
    setRandomSheet(true);
  };
  const saveRandom = async () => {
    await update({ random_extra_count: randomCount });
    setRandomSheet(false);
  };

  // ----- Questions editor -----
  const openQuestions = () => {
    setQuestions(settings.question_pool);
    setNewQuestion('');
    setRandomSheet(false);
    setQuestionsSheet(true);
  };
  const addQuestion = () => {
    const text = newQuestion.trim();
    if (!text) return;
    const nextId = questions.reduce((m, q) => Math.max(m, q.id), 0) + 1;
    setQuestions((prev) => [
      { id: nextId, text, category: 'custom', time_pref: 'any' },
      ...prev,
    ]);
    setNewQuestion('');
  };
  const editQuestion = (id: number, text: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, text } : q)));
  };
  const deleteQuestion = (id: number) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };
  const saveQuestions = async () => {
    const cleaned = questions.filter((q) => q.text.trim().length > 0);
    await update({ question_pool: cleaned });
    setQuestionsSheet(false);
  };
  const resetQuestions = () => {
    Alert.alert(t('settings:resetQuestions'), '', [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:confirm'),
        onPress: () => setQuestions(BUNDLED_QUESTIONS),
      },
    ]);
  };

  // ----- Quiet hours -----
  const openQuiet = () => {
    setQuietStart(settings.quiet_hours.start);
    setQuietEnd(settings.quiet_hours.end);
    setQuietSheet(true);
  };
  const saveQuiet = async () => {
    await update({ quiet_hours: { start: quietStart, end: quietEnd } });
    setQuietSheet(false);
  };

  // ----- Backup / restore / wipe -----
  const doBackup = async () => {
    setBusy(true);
    try {
      await exportBackup(backupPw || undefined);
      setBackupSheet(false);
      setBackupPw('');
    } catch {
      Alert.alert(t('common:error'), t('common:errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const applyImport = async (raw: string, password?: string) => {
    let payload;
    try {
      payload = parseBackup(raw, password);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'PASSWORD_REQUIRED') {
        setPendingRaw(raw);
        setRestorePwSheet(true);
        return;
      }
      if (msg === 'WRONG_PASSWORD') {
        Alert.alert(t('common:error'), t('settings:wrongPassword'));
        return;
      }
      Alert.alert(t('common:error'), t('settings:invalidFile'));
      return;
    }
    Alert.alert(t('settings:importMode.title'), '', [
      { text: t('settings:importMode.overwrite'), onPress: () => runImport(payload!, 'overwrite') },
      { text: t('settings:importMode.merge'), onPress: () => runImport(payload!, 'merge') },
      { text: t('common:cancel'), style: 'cancel' },
    ]);
  };

  const runImport = async (
    payload: Awaited<ReturnType<typeof parseBackup>>,
    mode: 'overwrite' | 'merge'
  ) => {
    setBusy(true);
    try {
      await importData(
        {
          responses: payload.responses,
          diaries: payload.diaries,
          settings: payload.settings,
          folders: payload.folders,
          notes: payload.notes,
        },
        mode
      );
      await reload();
      const fresh = await getAllSettings();
      await rescheduleAll(fresh);
      Alert.alert(t('common:appName'), t('settings:restoreDone'));
    } catch {
      Alert.alert(t('common:error'), t('common:errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    try {
      const picked = await pickBackupFile();
      if (!picked) return;
      if (picked.encrypted) {
        setPendingRaw(picked.raw);
        setRestorePw('');
        setRestorePwSheet(true);
      } else {
        await applyImport(picked.raw);
      }
    } catch {
      Alert.alert(t('common:error'), t('settings:invalidFile'));
    }
  };

  const confirmRestorePw = async () => {
    setRestorePwSheet(false);
    await applyImport(pendingRaw, restorePw);
  };

  const onWipe = () => {
    Alert.alert(t('settings:wipeConfirm1.title'), t('settings:wipeConfirm1.body'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:delete'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('settings:wipeConfirm2.title'), t('settings:wipeConfirm2.body'), [
            { text: t('common:cancel'), style: 'cancel' },
            {
              text: t('settings:wipeConfirm2.action'),
              style: 'destructive',
              onPress: async () => {
                await wipeAllData();
                await reload();
                Alert.alert(t('common:appName'), t('settings:wipeDone'));
              },
            },
          ]),
      },
    ]);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.screenTitle}>{t('settings:title')}</Text>

        <Text style={styles.section}>{t('settings:sections.notifications')}</Text>
        <View style={styles.card}>
          <Row
            label={t('settings:notifTimes')}
            value={t('settings:notifTimesDesc', {
              fixed: enabledFixed,
              random: settings.random_extra_count,
            })}
            onPress={openNotif}
          />
          <Divider />
          <Row
            label={t('settings:randomExtra')}
            value={t('settings:randomExtraDesc', { count: settings.random_extra_count })}
            onPress={openRandom}
          />
          <Divider />
          <Row
            label={t('settings:quietHours')}
            value={t('settings:quietHoursDesc', {
              start: settings.quiet_hours.start,
              end: settings.quiet_hours.end,
            })}
            onPress={openQuiet}
          />
        </View>

        <Text style={styles.section}>{t('settings:sections.diary')}</Text>
        <View style={styles.card}>
          <View style={styles.inlineRow}>
            <TimePickerField
              label={t('settings:compileTime')}
              value={settings.diary_compile_time}
              onChange={(hm) => update({ diary_compile_time: hm })}
            />
            <Text style={styles.inlineHint}>{t('settings:compileTimeDesc')}</Text>
          </View>
          <Divider />
          <View style={styles.tonePadded}>
            <Text style={styles.rowLabel}>{t('settings:aiTone')}</Text>
            <View style={styles.toneRow}>
              {TONES.map((tone) => (
                <Pressable
                  key={tone}
                  onPress={() => update({ ai_tone: tone })}
                  style={[styles.toneChip, settings.ai_tone === tone && styles.toneChipActive]}
                >
                  <Text style={[styles.toneText, settings.ai_tone === tone && styles.toneTextActive]}>
                    {t(`common:tone.${tone}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {settings.ai_tone === 'custom' && (
              <>
                <TextInput
                  style={styles.input}
                  value={customStyle}
                  onChangeText={setCustomStyle}
                  onEndEditing={() => update({ ai_custom_style: customStyle.trim() })}
                  placeholder={t('settings:aiCustomPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.helpText}>{t('settings:aiCustomHint')}</Text>
              </>
            )}
          </View>
        </View>

        <Text style={styles.section}>{t('settings:sections.data')}</Text>
        <View style={styles.card}>
          <Row label={t('settings:backup')} value={t('settings:backupDesc')} onPress={() => { setBackupPw(''); setBackupSheet(true); }} />
          <Divider />
          <Row label={t('settings:restore')} value={t('settings:restoreDesc')} onPress={onRestore} />
          <Divider />
          <Row label={t('settings:wipe')} value={t('settings:wipeDesc')} danger onPress={onWipe} />
        </View>

        <Text style={styles.section}>{t('settings:sections.info')}</Text>
        <View style={styles.card}>
          <Row label={t('settings:appVersion')} value={version} />
          <Divider />
          <Row label={t('settings:privacy')} onPress={() => setInfoSheet('privacy')} />
          <Divider />
          <Row label={t('settings:dataHandling')} onPress={() => setInfoSheet('data')} />
        </View>
      </ScrollView>

      {/* Notification times sheet */}
      <Sheet visible={notifSheet} title={t('settings:notifTimes')} onClose={() => setNotifSheet(false)}>
        <Text style={styles.helpText}>{t('settings:slotQuestionHint')}</Text>
        {times.map((tm, i) => (
          <View key={i} style={styles.slotCard}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotIndex}>{i + 1}</Text>
              <Switch
                value={slotOn[i]}
                onValueChange={(v) => setSlotOn((prev) => prev.map((x, idx) => (idx === i ? v : x)))}
              />
            </View>
            {slotOn[i] && (
              <>
                <TimePickerField
                  value={tm}
                  onChange={(hm) => setTimes((prev) => prev.map((x, idx) => (idx === i ? hm : x)))}
                />
                <TextInput
                  style={styles.input}
                  value={slotQ[i]}
                  onChangeText={(text) => setSlotQ((prev) => prev.map((x, idx) => (idx === i ? text : x)))}
                  placeholder={t('settings:slotQuestionPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}
          </View>
        ))}
        <Button title={t('common:done')} onPress={saveNotif} style={{ marginTop: spacing.md }} />
      </Sheet>

      {/* Random sheet */}
      <Sheet visible={randomSheet} title={t('settings:randomExtra')} onClose={() => setRandomSheet(false)}>
        <Text style={styles.helpText}>{t('settings:randomExtraExplain')}</Text>
        <Text style={[styles.rowLabel, { marginTop: spacing.md }]}>{t('settings:randomCountTitle')}</Text>
        <View style={styles.toneRow}>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => setRandomCount(n)}
              style={[styles.toneChip, randomCount === n && styles.toneChipActive]}
            >
              <Text style={[styles.toneText, randomCount === n && styles.toneTextActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          title={t('settings:editQuestions')}
          variant="secondary"
          onPress={openQuestions}
          style={{ marginTop: spacing.lg }}
        />
        <Button title={t('common:done')} onPress={saveRandom} style={{ marginTop: spacing.sm }} />
      </Sheet>

      {/* Question editor sheet */}
      <Sheet
        visible={questionsSheet}
        title={`${t('settings:questionsTitle')} · ${t('settings:questionsCount', { count: questions.length })}`}
        onClose={() => setQuestionsSheet(false)}
      >
        <Text style={styles.helpText}>{t('settings:questionsHint')}</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, styles.flex, { marginTop: 0 }]}
            value={newQuestion}
            onChangeText={setNewQuestion}
            placeholder={t('settings:addQuestionPlaceholder')}
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={addQuestion}
          />
          <Pressable onPress={addQuestion} style={styles.addBtn}>
            <Text style={styles.addBtnText}>{t('settings:addQuestion')}</Text>
          </Pressable>
        </View>
        {questions.map((q) => (
          <View key={q.id} style={styles.qRow}>
            <TextInput
              style={[styles.input, styles.flex, { marginTop: 0 }]}
              value={q.text}
              onChangeText={(text) => editQuestion(q.id, text)}
            />
            <Pressable onPress={() => deleteQuestion(q.id)} style={styles.delBtn}>
              <Text style={styles.delBtnText}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Button title={t('settings:resetQuestions')} variant="ghost" onPress={resetQuestions} style={{ marginTop: spacing.md }} />
        <Button title={t('common:save')} onPress={saveQuestions} style={{ marginTop: spacing.sm }} />
      </Sheet>

      {/* Quiet hours sheet */}
      <Sheet visible={quietSheet} title={t('settings:quietHours')} onClose={() => setQuietSheet(false)}>
        <Text style={styles.helpText}>{t('settings:quietHoursExplain')}</Text>
        <View style={styles.sheetRow}>
          <TimePickerField label="시작" value={quietStart} onChange={setQuietStart} />
        </View>
        <View style={styles.sheetRow}>
          <TimePickerField label="끝" value={quietEnd} onChange={setQuietEnd} />
        </View>
        <Button title={t('common:done')} onPress={saveQuiet} style={{ marginTop: spacing.md }} />
      </Sheet>

      {/* Backup password sheet */}
      <Sheet visible={backupSheet} title={t('settings:backup')} onClose={() => setBackupSheet(false)}>
        <Text style={styles.rowLabel}>{t('settings:backupPassword')}</Text>
        <Text style={styles.helpText}>{t('settings:backupPasswordDesc')}</Text>
        <TextInput
          style={styles.input}
          value={backupPw}
          onChangeText={setBackupPw}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••"
          placeholderTextColor={colors.textMuted}
        />
        <Button title={t('settings:createBackup')} onPress={doBackup} loading={busy} style={{ marginTop: spacing.md }} />
      </Sheet>

      {/* Restore password sheet */}
      <Sheet visible={restorePwSheet} title={t('settings:restorePassword')} onClose={() => setRestorePwSheet(false)}>
        <Text style={styles.helpText}>{t('settings:restorePasswordPrompt')}</Text>
        <TextInput
          style={styles.input}
          value={restorePw}
          onChangeText={setRestorePw}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••"
          placeholderTextColor={colors.textMuted}
        />
        <Button title={t('common:confirm')} onPress={confirmRestorePw} loading={busy} style={{ marginTop: spacing.md }} />
      </Sheet>

      {/* Info sheet */}
      <Sheet
        visible={infoSheet !== null}
        title={infoSheet === 'privacy' ? t('settings:privacy') : t('settings:dataHandling')}
        onClose={() => setInfoSheet(null)}
      >
        <Text style={styles.infoBody}>
          {infoSheet === 'privacy' ? t('settings:privacyBody') : t('settings:dataHandlingBody')}
        </Text>
      </Sheet>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  onPress,
  danger,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}>
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
        {value ? <Text style={styles.rowValue} numberOfLines={2}>{value}</Text> : null}
      </View>
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: spacing.xl },
  screenTitle: { fontSize: font.title, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  section: { fontSize: font.small, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  rowPressed: { backgroundColor: colors.primaryLight },
  rowLabel: { fontSize: font.body, color: colors.text },
  rowValue: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  danger: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
  inlineRow: { padding: spacing.md },
  inlineHint: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm },
  tonePadded: { padding: spacing.md },
  toneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  toneChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, minWidth: 44, alignItems: 'center' },
  toneChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  toneText: { color: colors.textSecondary, fontWeight: '600' },
  toneTextActive: { color: colors.primary },
  sheetRow: { marginBottom: spacing.md },
  slotCard: { backgroundColor: colors.card, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  slotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotIndex: { fontSize: font.body, fontWeight: '700', color: colors.primary },
  input: { backgroundColor: colors.card, borderRadius: radius.sm, padding: spacing.md, fontSize: font.body, color: colors.text, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  helpText: { fontSize: font.tiny, color: colors.textSecondary, marginBottom: spacing.xs, lineHeight: 18 },
  infoBody: { fontSize: font.body, color: colors.text, lineHeight: 26 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.sm },
  addBtnText: { color: colors.white, fontWeight: '700' },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  delBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  delBtnText: { color: colors.textMuted, fontSize: font.body },
});
