import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { createNote, deleteNote, getNotes, updateNote } from '../db';
import { scheduleAllNoteReminders } from '../notifications';
import { colors, font, radius, spacing } from '../theme';
import { Note } from '../types';
import { formatLongDate, nowTimeStr } from '../utils/date';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DateNotes'>;

export function DateNotesScreen({ route, navigation }: Props) {
  const { date } = route.params;
  const { t } = useTranslation(['notes', 'common']);
  const [notes, setNotes] = useState<Note[]>([]);
  const [menu, setMenu] = useState<Note | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: formatLongDate(date) });
  }, [navigation, date]);

  const load = useCallback(async () => {
    setNotes(await getNotes({ noteDate: date }));
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAdd = async () => {
    const id = await createNote({
      title: nowTimeStr(),
      content: '',
      folder_id: null,
      note_date: date,
    });
    navigation.navigate('NoteEditor', { noteId: id });
  };

  const removeNote = async (n: Note) => {
    await deleteNote(n.id);
    await scheduleAllNoteReminders();
    setMenu(null);
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.list}>
        {notes.length === 0 ? (
          <Text style={styles.empty}>{t('notes:empty')}</Text>
        ) : (
          notes.map((n) => (
            <Pressable
              key={n.id}
              style={styles.card}
              onPress={() => navigation.navigate('NoteEditor', { noteId: n.id })}
              onLongPress={() => setMenu(n)}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {n.title.trim() || t('notes:untitled')}
              </Text>
              {!!n.content.trim() && (
                <Text style={styles.snippet} numberOfLines={1}>
                  {n.content.trim()}
                </Text>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button title={t('notes:addNote')} onPress={onAdd} />
      </View>

      <Sheet visible={!!menu} title={menu?.title || ' '} onClose={() => setMenu(null)}>
        {menu && (
          <Pressable onPress={() => removeNote(menu)} style={styles.menuItem}>
            <Text style={styles.menuDanger}>{t('notes:menu.delete')}</Text>
          </Pressable>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: font.body, fontWeight: '600', color: colors.text },
  snippet: { fontSize: font.small, color: colors.textSecondary, marginTop: 2 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  menuItem: { paddingVertical: spacing.md },
  menuDanger: { color: colors.danger, fontSize: font.body },
});
