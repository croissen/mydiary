import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { getDiaryByDate, getResponsesByDate } from '../db';
import { saveEditedDiary } from '../services/diary';
import { colors, font, radius, spacing } from '../theme';
import { DiaryRow, ResponseRow } from '../types';
import { formatLongDate } from '../utils/date';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Diary'>;

export function DiaryScreen({ route }: Props) {
  const { date } = route.params;
  const { t } = useTranslation(['diary', 'common']);
  const insets = useSafeAreaInsets();

  const [diary, setDiary] = useState<DiaryRow | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResponses, setShowResponses] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    const [d, rows] = await Promise.all([
      getDiaryByDate(date),
      getResponsesByDate(date),
    ]);
    setDiary(d);
    setResponses(rows);
    setLoading(false);
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const startEdit = () => {
    setDraft(diary?.content ?? '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!diary) return;
    await saveEditedDiary(date, draft.trim(), diary.tone);
    setEditing(false);
    load();
  };

  const onShare = async () => {
    if (!diary) return;
    await Share.share({ message: diary.content });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!diary) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.muted}>{t('diary:noDiary')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.date}>{formatLongDate(date)}</Text>
        {diary.user_edited === 1 && (
          <Text style={styles.editedBadge}>{t('diary:edited')}</Text>
        )}

        {editing ? (
          <TextInput
            style={styles.editInput}
            multiline
            value={draft}
            onChangeText={setDraft}
            textAlignVertical="top"
            placeholder={t('diary:editPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
        ) : (
          <Text style={styles.content}>{diary.content}</Text>
        )}

        {!editing && (
          <>
            <Pressable
              onPress={() => setShowResponses((v) => !v)}
              style={styles.toggle}
            >
              <Text style={styles.toggleText}>
                {showResponses
                  ? t('diary:hideResponses')
                  : t('diary:showResponses')}
              </Text>
            </Pressable>

            {showResponses &&
              (responses.length === 0 ? (
                <Text style={styles.muted}>{t('diary:noResponses')}</Text>
              ) : (
                responses.map((r) => (
                  <View key={r.id} style={styles.respCard}>
                    <Text style={styles.respTime}>{r.time}</Text>
                    <Text style={styles.respQ}>{r.question_text}</Text>
                    <Text style={styles.respA}>
                      {r.skipped ? '—' : r.answer}
                    </Text>
                  </View>
                ))
              ))}
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        {editing ? (
          <>
            <Button
              title={t('common:cancel')}
              variant="ghost"
              onPress={() => setEditing(false)}
              style={styles.footerBtn}
            />
            <View style={styles.flex}>
              <Button title={t('diary:saveEdit')} onPress={saveEdit} />
            </View>
          </>
        ) : (
          <>
            <Button
              title={t('common:edit')}
              variant="secondary"
              onPress={startEdit}
              style={styles.footerBtn}
            />
            <View style={styles.flex}>
              <Button title={t('common:share')} onPress={onShare} />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, paddingBottom: spacing.xl },
  date: { fontSize: font.body, fontWeight: '700', color: colors.text },
  editedBadge: {
    fontSize: font.tiny,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  content: {
    fontSize: font.body,
    color: colors.text,
    lineHeight: 28,
    marginTop: spacing.md,
  },
  editInput: {
    fontSize: font.body,
    color: colors.text,
    lineHeight: 28,
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 220,
  },
  toggle: { marginTop: spacing.xl, paddingVertical: spacing.sm },
  toggleText: { color: colors.primary, fontWeight: '600', fontSize: font.small },
  respCard: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  respTime: { fontSize: font.tiny, fontWeight: '700', color: colors.primary },
  respQ: { fontSize: font.tiny, color: colors.textSecondary, marginTop: 2 },
  respA: { fontSize: font.small, color: colors.text, marginTop: spacing.xs },
  muted: { color: colors.textMuted, fontSize: font.small },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  footerBtn: { paddingHorizontal: spacing.lg },
});
