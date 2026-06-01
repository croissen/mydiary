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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { TimePickerField } from '../components/TimePickerField';
import { getAllSettings } from '../db';
import { rescheduleAll } from '../notifications';
import { useSettings } from '../state/SettingsContext';
import { useAuth } from '../auth/AuthContext';
import { usePro } from '../purchases/PurchasesContext';
import { BUNDLED_QUESTIONS } from '../settings/defaults';
import { colors, font, radius, spacing } from '../theme';
import { AiTone, Question } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TONES: AiTone[] = ['casual', 'literary', 'concise', 'custom'];
const MIN_SLOTS = 3;
const MAX_SLOTS = 10;

export function SettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);
  const { settings, update, reload } = useSettings();
  const navigation = useNavigation<Nav>();
  const { user, signOut, updateDisplayName, syncToCloud, restoreFromCloud, startTrial, trialStarted } = useAuth();
  const { isPro, isTrialing, trialDaysLeft } = usePro();

  const [nameSheet, setNameSheet] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameBusy, setNameBusy] = useState(false);

  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '';

  const openNameEdit = () => {
    setNameInput(displayName);
    setNameSheet(true);
  };
  const saveNameEdit = async () => {
    setNameBusy(true);
    try { await updateDisplayName(nameInput.trim()); setNameSheet(false); }
    catch { Alert.alert('오류', '이름 변경에 실패했어요.'); }
    finally { setNameBusy(false); }
  };

  const planLabel = isTrialing
    ? `무료 체험 중 D-${trialDaysLeft}`
    : isPro && trialStarted
    ? '프리미엄'
    : !trialStarted
    ? '무료'
    : '무료';

  const [notifSheet, setNotifSheet] = useState(false);
  const [randomSheet, setRandomSheet] = useState(false);
  const [questionsSheet, setQuestionsSheet] = useState(false);
  const [quietSheet, setQuietSheet] = useState(false);
  const [privacySheet, setPrivacySheet] = useState(false);
  const [dataSheet, setDataSheet] = useState(false);
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
  const [busy, setBusy] = useState(false);

  // ----- Account -----
  const doSignOut = () => {
    Alert.alert(t('settings:logoutConfirm'), '', [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('settings:logout'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const doSyncToCloud = async () => {
    setBusy(true);
    try {
      await syncToCloud();
      Alert.alert(t('common:appName'), t('settings:syncDone'));
    } catch {
      Alert.alert(t('common:error'), t('settings:syncFailed'));
    } finally {
      setBusy(false);
    }
  };

  const doRestoreFromCloud = async () => {
    setBusy(true);
    try {
      const restored = await restoreFromCloud();
      if (!restored) {
        Alert.alert(t('common:appName'), t('settings:restoreNotFound'));
        return;
      }
      await reload();
      const fresh = await getAllSettings();
      await rescheduleAll(fresh);
      Alert.alert(t('common:appName'), t('settings:restoreCloudDone'));
    } catch {
      Alert.alert(t('common:error'), t('common:errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

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
  const addNotifSlot = () => {
    if (times.length >= MAX_SLOTS) return;
    setTimes((p) => [...p, '09:00']);
    setSlotOn((p) => [...p, true]);
    setSlotQ((p) => [...p, '']);
  };
  const removeNotifSlot = (i: number) => {
    if (times.length <= MIN_SLOTS) return;
    setTimes((p) => p.filter((_, idx) => idx !== i));
    setSlotOn((p) => p.filter((_, idx) => idx !== i));
    setSlotQ((p) => p.filter((_, idx) => idx !== i));
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

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.screenTitle}>{t('settings:title')}</Text>

        {/* 계정 섹션 */}
        <Text style={styles.section}>{t('settings:sections.account')}</Text>
        <View style={styles.card}>
          {/* 이름 */}
          <Pressable style={styles.row} onPress={openNameEdit}>
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>
                {displayName ? `${displayName} 님` : '이름 미설정'}
              </Text>
            </View>
            <Text style={styles.editIcon}>✏️</Text>
          </Pressable>
          <Divider />
          {/* 이메일 */}
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{user?.email}</Text>
          </View>
          <Divider />
          {/* 플랜 */}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>{planLabel}</Text>
            </View>
            {!trialStarted ? (
              <Pressable
                onPress={async () => {
                  try {
                    await startTrial();
                  } catch {
                    Alert.alert('오류', '체험 시작에 실패했어요.');
                  }
                }}
                style={styles.planBtn}
              >
                <Text style={styles.planBtnText}>7일 무료체험 시작</Text>
              </Pressable>
            ) : isTrialing ? (
              <Pressable onPress={() => navigation.navigate('Paywall')} style={styles.planBtn}>
                <Text style={styles.planBtnText}>프리미엄 시작하기</Text>
              </Pressable>
            ) : isPro ? (
              <Pressable onPress={() => navigation.navigate('Subscription')} style={styles.planBtn}>
                <Text style={styles.planBtnText}>구독 관리</Text>
              </Pressable>
            ) : null}
          </View>
          <Divider />
          <Row label={t('settings:syncToCloud')} value={t('settings:syncToCloudDesc')} onPress={doSyncToCloud} />
          <Divider />
          <Row label={t('settings:restoreFromCloud')} value={t('settings:restoreFromCloudDesc')} onPress={doRestoreFromCloud} />
          <Divider />
          <Row label={t('settings:logout')} danger onPress={doSignOut} />
        </View>

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

        <Text style={styles.section}>{t('settings:sections.info')}</Text>
        <View style={styles.card}>
          <Row label={t('settings:appVersion')} value={version} />
          <Divider />
          <Row label={t('settings:privacy')} onPress={() => setPrivacySheet(true)} />
          <Divider />
          <Row label={t('settings:dataHandling')} onPress={() => setDataSheet(true)} />
        </View>
      </ScrollView>

      {/* Notification times sheet */}
      <Sheet visible={notifSheet} title={t('settings:notifTimes')} onClose={() => setNotifSheet(false)}>
        <Text style={styles.helpText}>{t('settings:slotQuestionHint')}</Text>
        {times.map((tm, i) => (
          <View key={i} style={styles.slotCard}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotIndex}>{i + 1}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {times.length > MIN_SLOTS && (
                  <Pressable onPress={() => removeNotifSlot(i)} style={styles.slotRemoveBtn}>
                    <Text style={styles.slotRemoveBtnText}>−</Text>
                  </Pressable>
                )}
                <Switch
                  value={slotOn[i]}
                  onValueChange={(v) => setSlotOn((prev) => prev.map((x, idx) => (idx === i ? v : x)))}
                />
              </View>
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
        {times.length < MAX_SLOTS && (
          <Pressable onPress={addNotifSlot} style={styles.addSlotBtn}>
            <Text style={styles.addSlotBtnText}>+ 알림 시간 추가</Text>
          </Pressable>
        )}
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

      {/* Privacy sheet */}
      <Sheet visible={privacySheet} title={t('settings:privacy')} onClose={() => setPrivacySheet(false)}>
        <Text style={styles.infoBody}>{t('settings:privacyBody')}</Text>
      </Sheet>

      {/* Data handling sheet */}
      <Sheet visible={dataSheet} title={t('settings:dataHandling')} onClose={() => setDataSheet(false)}>
        <Text style={styles.infoBody}>{t('settings:dataHandlingBody')}</Text>
      </Sheet>

      {/* 이름 수정 Sheet */}
      <Sheet visible={nameSheet} title="이름 수정" onClose={() => setNameSheet(false)}>
        <TextInput
          style={styles.input}
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="이름을 입력하세요"
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
        <Button title="저장" onPress={saveNameEdit} loading={nameBusy} style={{ marginTop: spacing.md }} />
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
  editIcon: { fontSize: 16 },
  planBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  planBtnText: { fontSize: font.tiny, color: colors.white, fontWeight: '700' },
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
  slotRemoveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  slotRemoveBtnText: { fontSize: 18, color: colors.textSecondary, lineHeight: 22 },
  addSlotBtn: { paddingVertical: spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs },
  addSlotBtnText: { fontSize: font.small, fontWeight: '600', color: colors.primary },
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
