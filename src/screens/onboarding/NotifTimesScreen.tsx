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

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotifTimes'>;

export function NotifTimesScreen({ navigation }: Props) {
  const { t } = useTranslation('onboarding');
  const { update } = useSettings();
  const [times, setTimes] = useState<string[]>([
    ...DEFAULT_SETTINGS.notification_times,
  ]);
  const [questions, setQuestions] = useState<string[]>(['', '', '', '', '']);
  const [randomOn, setRandomOn] = useState(true);
  const [randomCount, setRandomCount] = useState(2);

  const setTime = (i: number, hm: string) => {
    setTimes((prev) => prev.map((x, idx) => (idx === i ? hm : x)));
  };
  const setQuestion = (i: number, text: string) => {
    setQuestions((prev) => prev.map((x, idx) => (idx === i ? text : x)));
  };

  const allSet = times.length === 5 && times.every((x) => /^\d{2}:\d{2}$/.test(x));

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

        <View style={styles.card}>
          {times.map((time, i) => (
            <View key={i} style={[styles.slotRow, i > 0 && styles.divider]}>
              <TimePickerField
                label={t('times.slot', { index: i + 1 })}
                value={time}
                onChange={(hm) => setTime(i, hm)}
              />
              <TextInput
                style={styles.qInput}
                value={questions[i]}
                onChangeText={(text) => setQuestion(i, text)}
                placeholder={t('times.questionPlaceholder')}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          ))}
          <Text style={styles.qHint}>{t('times.questionHint')}</Text>
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
                  style={[
                    styles.countChip,
                    randomCount === n && styles.countChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      randomCount === n && styles.countTextActive,
                    ]}
                  >
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
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: font.small,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  slotRow: { paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
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
  qHint: {
    fontSize: font.tiny,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  toggleTitle: { fontSize: font.body, fontWeight: '600', color: colors.text },
  toggleDesc: {
    fontSize: font.tiny,
    color: colors.textSecondary,
    marginTop: 2,
  },
  countRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  countChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  countText: { color: colors.textSecondary, fontWeight: '600' },
  countTextActive: { color: colors.primary },
  footer: { padding: spacing.lg },
  warn: {
    color: colors.warning,
    fontSize: font.small,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
