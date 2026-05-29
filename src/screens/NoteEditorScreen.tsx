import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { TimePickerField } from '../components/TimePickerField';
import { deleteNote, getNoteById, updateNote } from '../db';
import { nextOccurrenceMs, scheduleAllNoteReminders } from '../notifications';
import { colors, font, radius, spacing } from '../theme';
import { ReminderRepeat } from '../types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NoteEditor'>;

export function NoteEditorScreen({ route, navigation }: Props) {
  const { noteId } = route.params;
  const { t } = useTranslation(['notes', 'common']);
  const insets = useSafeAreaInsets();

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [repeat, setRepeat] = useState<ReminderRepeat>('once');

  // Latest values for the auto-save on unmount.
  const ref = useRef({ title, content, reminderOn, reminderTime, repeat });
  ref.current = { title, content, reminderOn, reminderTime, repeat };
  // The auto-generated default title; used to detect an untouched note.
  const originalTitle = useRef('');

  useEffect(() => {
    (async () => {
      const note = await getNoteById(noteId);
      if (note) {
        originalTitle.current = note.title;
        setTitle(note.title);
        setContent(note.content);
        setReminderOn(note.reminder_enabled === 1);
        setReminderTime(note.reminder_time);
        setRepeat(note.reminder_repeat);
      }
      setLoaded(true);
    })();
  }, [noteId]);

  // Save unless the note is untouched (default title kept AND no content) — in
  // that case discard it so empty notes don't pile up. Returns true if saved.
  const persist = async (): Promise<boolean> => {
    const s = ref.current;
    const untouched =
      !s.content.trim() && s.title.trim() === originalTitle.current.trim();
    if (untouched) {
      await deleteNote(noteId);
      await scheduleAllNoteReminders();
      return false;
    }
    await updateNote(noteId, {
      title: s.title,
      content: s.content,
      reminder_enabled: s.reminderOn ? 1 : 0,
      reminder_time: s.reminderTime,
      reminder_repeat: s.repeat,
      reminder_at:
        s.reminderOn && s.repeat === 'once'
          ? nextOccurrenceMs(s.reminderTime)
          : 0,
    });
    await scheduleAllNoteReminders();
    return true;
  };

  // Auto-save on leave (back gesture), silently.
  useEffect(() => {
    return () => {
      persist();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const onSave = async () => {
    const saved = await persist();
    if (saved) ToastAndroid.show(t('notes:editor.saved'), ToastAndroid.SHORT);
    navigation.goBack();
  };

  const onDelete = () => {
    Alert.alert(t('notes:deleteNoteConfirm'), '', [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteNote(noteId);
          await scheduleAllNoteReminders();
          navigation.goBack();
        },
      },
    ]);
  };

  if (!loaded) {
    return <SafeAreaView style={styles.safe} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.title}
            value={title}
            onChangeText={setTitle}
            placeholder={t('notes:editor.titlePlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={styles.content}
            value={content}
            onChangeText={setContent}
            placeholder={t('notes:editor.contentPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.reminderCard}>
            <View style={styles.reminderHeader}>
              <Text style={styles.reminderLabel}>{t('notes:editor.reminder')}</Text>
              <Switch value={reminderOn} onValueChange={setReminderOn} />
            </View>
            {reminderOn && (
              <>
                <View style={styles.reminderRow}>
                  <TimePickerField
                    label={t('notes:editor.reminderTime')}
                    value={reminderTime}
                    onChange={setReminderTime}
                  />
                </View>
                <View style={styles.repeatRow}>
                  {(['once', 'daily'] as ReminderRepeat[]).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setRepeat(r)}
                      style={[styles.repeatChip, repeat === r && styles.repeatChipActive]}
                    >
                      <Text style={[styles.repeatText, repeat === r && styles.repeatTextActive]}>
                        {r === 'once' ? t('notes:editor.repeatOnce') : t('notes:editor.repeatDaily')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.hint}>{t('notes:editor.reminderHint')}</Text>
              </>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button
            title={t('notes:editor.delete')}
            variant="ghost"
            onPress={onDelete}
            style={styles.delBtn}
          />
          <View style={styles.flex}>
            <Button title={t('notes:editor.save')} onPress={onSave} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { padding: spacing.lg },
  title: {
    fontSize: font.heading,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: {
    fontSize: font.body,
    color: colors.text,
    lineHeight: 24,
    marginTop: spacing.md,
    minHeight: 180,
  },
  reminderCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderLabel: { fontSize: font.body, fontWeight: '600', color: colors.text },
  reminderRow: { marginTop: spacing.md },
  repeatRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  repeatChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  repeatChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  repeatText: { color: colors.textSecondary, fontWeight: '600' },
  repeatTextActive: { color: colors.primary },
  hint: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  delBtn: { paddingHorizontal: spacing.lg },
});
