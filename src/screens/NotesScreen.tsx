import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { createNote, deleteNote, getNotes, updateNote } from '../db';
import { scheduleAllNoteReminders } from '../notifications';
import { colors, font, radius, spacing } from '../theme';
import { Note } from '../types';
import { noteDefaultTitle } from '../utils/date';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function NotesScreen() {
  const { t } = useTranslation(['notes', 'common']);
  const navigation = useNavigation<Nav>();

  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [noteMenu, setNoteMenu] = useState<Note | null>(null);
  const [prompt, setPrompt] = useState<{ id: number; value: string } | null>(
    null
  );

  const load = useCallback(async () => {
    setNotes(await getNotes({ query, general: true }));
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openNote = (id: number) =>
    navigation.navigate('NoteEditor', { noteId: id });

  const onAddNote = async () => {
    const id = await createNote({
      title: noteDefaultTitle(),
      content: '',
      folder_id: null,
    });
    openNote(id);
  };

  const toggleFav = async (note: Note) => {
    await updateNote(note.id, { favorite: note.favorite ? 0 : 1 });
    setNoteMenu(null);
    load();
  };

  const removeNote = async (note: Note) => {
    await deleteNote(note.id);
    await scheduleAllNoteReminders();
    setNoteMenu(null);
    load();
  };

  const submitRename = async () => {
    if (prompt && prompt.value.trim()) {
      await updateNote(prompt.id, { title: prompt.value.trim() });
    }
    setPrompt(null);
    setNoteMenu(null);
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('notes:title')}</Text>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t('notes:searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {notes.length === 0 ? (
          <Text style={styles.empty}>{t('notes:empty')}</Text>
        ) : (
          notes.map((n) => (
            <Pressable
              key={n.id}
              style={styles.noteCard}
              onPress={() => openNote(n.id)}
              onLongPress={() => setNoteMenu(n)}
            >
              <View style={styles.flex}>
                <Text style={styles.noteTitle} numberOfLines={1}>
                  {n.favorite ? '⭐ ' : ''}
                  {n.title.trim() || t('notes:untitled')}
                </Text>
                {!!n.content.trim() && (
                  <Text style={styles.noteSnippet} numberOfLines={1}>
                    {n.content.trim()}
                  </Text>
                )}
              </View>
              {n.reminder_enabled === 1 && <Text style={styles.bell}>🔔</Text>}
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title={t('notes:addNote')} onPress={onAddNote} />
      </View>

      {/* Note long-press menu */}
      <Sheet
        visible={!!noteMenu}
        title={noteMenu?.title || ' '}
        onClose={() => setNoteMenu(null)}
      >
        {noteMenu && (
          <>
            <MenuItem
              label={
                noteMenu.favorite
                  ? t('notes:menu.unfavorite')
                  : t('notes:menu.favorite')
              }
              onPress={() => toggleFav(noteMenu)}
            />
            <MenuItem
              label={t('notes:menu.rename')}
              onPress={() => setPrompt({ id: noteMenu.id, value: noteMenu.title })}
            />
            <MenuItem
              label={t('notes:menu.delete')}
              danger
              onPress={() => removeNote(noteMenu)}
            />
          </>
        )}
      </Sheet>

      {/* Rename prompt */}
      <Sheet
        visible={!!prompt}
        title={t('notes:renameNoteTitle')}
        onClose={() => setPrompt(null)}
      >
        <TextInput
          style={styles.promptInput}
          value={prompt?.value ?? ''}
          onChangeText={(v) => setPrompt((p) => (p ? { ...p, value: v } : p))}
          autoFocus
        />
        <Button
          title={t('common:confirm')}
          onPress={submitRename}
          style={{ marginTop: spacing.md }}
        />
      </Sheet>
    </SafeAreaView>
  );
}

function MenuItem({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}
    >
      <Text style={[styles.menuText, danger && styles.menuDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  search: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xl,
    lineHeight: 22,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noteTitle: { fontSize: font.body, fontWeight: '600', color: colors.text },
  noteSnippet: {
    fontSize: font.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bell: { fontSize: font.body, marginLeft: spacing.sm },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  menuItem: { paddingVertical: spacing.md },
  menuPressed: { opacity: 0.6 },
  menuText: { fontSize: font.body, color: colors.text },
  menuDanger: { color: colors.danger },
  promptInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: font.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
