import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import {
  createNote,
  getDiaryByDate,
  getDiaryDates,
  getResponsesByDate,
} from '../db';
import { useSettings } from '../state/SettingsContext';
import { colors, font, radius, spacing } from '../theme';
import { ResponseRow } from '../types';
import {
  currentWeekSunToSat,
  formatLongDate,
  noteDefaultTitle,
  todayStr,
} from '../utils/date';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const { t } = useTranslation(['home', 'common']);
  const { settings } = useSettings();
  const navigation = useNavigation<Nav>();

  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [hasDiary, setHasDiary] = useState(false);
  const [diarySet, setDiarySet] = useState<Set<string>>(new Set());

  const today = todayStr();
  const week = currentWeekSunToSat();
  const weekdayLabels = t('common:weekdays', { returnObjects: true }) as string[];

  const load = useCallback(async () => {
    const [rows, diary, dDates] = await Promise.all([
      getResponsesByDate(today),
      getDiaryByDate(today),
      getDiaryDates(),
    ]);
    setResponses(rows);
    setHasDiary(!!diary);
    setDiarySet(new Set(dDates));
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const answeredCount = responses.filter(
    (r) => r.skipped === 0 && r.answer.trim().length > 0
  ).length;

  const createAndOpenNote = async () => {
    const id = await createNote({
      title: noteDefaultTitle(),
      content: '',
      folder_id: null,
      note_date: today,
    });
    navigation.navigate('NoteEditor', { noteId: id });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.date}>{formatLongDate(today)}</Text>
        <Text style={styles.greeting}>{t('home:greeting')}</Text>

        <Text style={styles.weekLabel}>{t('home:weekProgress')}</Text>
        <View style={styles.weekRow}>
          {week.map((d, i) => {
            const has = diarySet.has(d);
            const isToday = d === today;
            return (
              <View key={d} style={styles.weekCol}>
                <Text
                  style={[
                    styles.weekday,
                    i === 0 && { color: colors.danger },
                    i === 6 && { color: colors.primary },
                  ]}
                >
                  {weekdayLabels[i]}
                </Text>
                <View
                  style={[
                    styles.dot,
                    has ? styles.dotOn : styles.dotOff,
                    isToday && styles.dotToday,
                  ]}
                />
              </View>
            );
          })}
        </View>

        {responses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('home:empty')}</Text>
          </View>
        ) : (
          responses
            .slice()
            .reverse()
            .map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTime}>{r.time}</Text>
                <Text
                  style={[
                    styles.cardStatus,
                    r.skipped ? styles.statusSkip : styles.statusOk,
                  ]}
                >
                  {r.skipped ? t('home:card.skipped') : t('home:card.answered')}
                </Text>
              </View>
              <Text style={styles.cardQuestion}>{r.question_text}</Text>
              {r.skipped === 0 && (
                <Text style={styles.cardAnswer}>{r.answer}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t('home:answer.title')}
          variant="secondary"
          onPress={() => navigation.navigate('Answer')}
          style={{ marginBottom: spacing.sm }}
        />
        <Button title={t('home:addNote')} onPress={createAndOpenNote} />
        {answeredCount > 0 && !hasDiary && (
          <Text style={styles.hint}>
            {t('home:diaryPending', { time: settings.diary_compile_time })}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, paddingBottom: spacing.xl },
  date: { fontSize: font.small, color: colors.textSecondary },
  greeting: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  weekLabel: {
    fontSize: font.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  weekCol: { alignItems: 'center', gap: 6, flex: 1 },
  weekday: { fontSize: font.tiny, color: colors.textMuted },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotOn: { backgroundColor: colors.primary },
  dotOff: { backgroundColor: colors.border },
  dotToday: { borderWidth: 2, borderColor: colors.primaryDark },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: font.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTime: { fontSize: font.small, fontWeight: '700', color: colors.primary },
  cardStatus: { fontSize: font.tiny, fontWeight: '600' },
  statusOk: { color: colors.success },
  statusSkip: { color: colors.textMuted },
  cardQuestion: { fontSize: font.small, color: colors.textSecondary },
  cardAnswer: {
    fontSize: font.body,
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  hint: {
    fontSize: font.tiny,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
