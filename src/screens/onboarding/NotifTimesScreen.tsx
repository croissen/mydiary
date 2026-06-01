import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { TimePickerField } from '../../components/TimePickerField';
import { useSettings } from '../../state/SettingsContext';
import { DEFAULT_SETTINGS } from '../../settings/defaults';
import { colors, font, radius, spacing } from '../../theme';
import { OnboardingStackParamList } from '../../navigation/types';

const MIN_SLOTS = 3;
const MAX_SLOTS = 10;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotifTimes'>;

export function NotifTimesScreen({ navigation }: Props) {
  const { t } = useTranslation('onboarding');
  const { update } = useSettings();
  const [times, setTimes] = useState<string[]>([...DEFAULT_SETTINGS.notification_times]);
  const [questions, setQuestions] = useState<string[]>(
    DEFAULT_SETTINGS.notification_times.map(() => '')
  );
  const [randomOn, setRandomOn] = useState(true);
  const [randomCount, setRandomCount] = useState(2);

  const addSlot = () => {
    if (times.length >= MAX_SLOTS) return;
    setTimes((p) => [...p, '09:00']);
    setQuestions((p) => [...p, '']);
  };

  const removeSlot = (i: number) => {
    if (times.length <= MIN_SLOTS) return;
    setTimes((p) => p.filter((_, idx) => idx !== i));
    setQuestions((p) => p.filter((_, idx) => idx !== i));
  };

  const allSet = times.length >= MIN_SLOTS && times.every((x) => /^\d{2}:\d{2}$/.test(x));

  const onDone = async () => {
    await update({
      notification_times: times,
      slot_questions: questions.map((q) => (q.trim() ? q.trim() : null)),
      random_extra_count: randomOn ? randomCount : 0,
    });
    navigation.navigate('CompileTime');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{t('times.title')}</Text>
        <Text style={styles.subtitle}>{t('times.subtitle')}</Text>
        <Text style={styles.settingsHint}>{t('times.settingsHint')}</Text>

        <View style={styles.card}>
          {times.map((time, i) => (
            <View key={i} style={[styles.slotRow, i > 0 && styles.divider]}>
              <View style={styles.slotHeader}>
                <Text style={styles.slotNum}>{i + 1}</Text>
                {times.length > MIN_SLOTS && (
                  <Pressable onPress={() => removeSlot(i)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>−</Text>
                  </Pressable>
                )}
              </View>
              <TimePickerField
                label={t('times.slot', { index: i + 1 })}
                value={time}
                onChange={(hm) => setTimes((prev) => prev.map((x, idx) => (idx === i ? hm : x)))}
              />
              <TextInput
                style={styles.qInput}
                value={questions[i]}
                onChangeText={(text) =>
                  setQuestions((prev) => prev.map((x, idx) => (idx === i ? text : x)))
                }
                placeholder={t('times.questionPlaceholder')}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          ))}
          <Text style={styles.qHint}>{t('times.questionHint')}</Text>
          {times.length < MAX_SLOTS && (
            <Pressable onPress={addSlot} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ {t('times.addSlot')}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>{t('times.randomToggle')}</Text>
              <Text style={styles.toggleDesc}>{t('times.randomDesc')}</Text>
            </View>
            <Switch value={randomOn} onValueChange={setRandomOn} />
          </View>
          {randomOn && (
            <View style={styles.countRow}>
              {[1, 2].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setRandomCount(n)}
                  style={[styles.countChip, randomCount === n && styles.countChipActive]}
                >
                  <Text style={[styles.countText, randomCount === n && styles.countTextActive]}>
                    {t('times.randomCount', { count: n })}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {!allSet && <Text style={styles.warn}>{t('times.needAll')}</Text>}
        <Button title={t('common:done', { defaultValue: '완료' })} onPress={onDone} disabled={!allSet} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: font.title, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: font.small, color: colors.textSecondary, marginBottom: spacing.xs },
  settingsHint: { fontSize: font.tiny, color: colors.textMuted, marginBottom: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  slotRow: { paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  slotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  slotNum: { fontSize: font.small, fontWeight: '700', color: colors.primary },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 18, color: colors.textSecondary, lineHeight: 22 },
  qInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.small,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qHint: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm },
  addBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  addBtnText: { fontSize: font.small, fontWeight: '600', color: colors.primary },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  toggleTitle: { fontSize: font.body, fontWeight: '600', color: colors.text },
  toggleDesc: { fontSize: font.tiny, color: colors.textSecondary, marginTop: 2 },
  countRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  countChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  countChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  countText: { color: colors.textSecondary, fontWeight: '600' },
  countTextActive: { color: colors.primary },
  footer: { padding: spacing.lg },
  warn: { color: colors.warning, fontSize: font.small, textAlign: 'center', marginBottom: spacing.sm },
});
