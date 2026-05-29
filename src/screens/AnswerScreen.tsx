import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { getQuestionById, pickQuestion } from '../data/questionPicker';
import { addResponse } from '../db';
import { colors, font, radius, spacing } from '../theme';
import { Question } from '../types';
import { nowTimeStr, todayStr } from '../utils/date';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Answer'>;

export function AnswerScreen({ route, navigation }: Props) {
  const { t } = useTranslation(['home', 'common']);
  const [question, setQuestion] = useState<Question | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const customText = route.params?.questionText;
      const paramId = route.params?.questionId;
      let q: Question;
      if (customText && customText.trim().length > 0) {
        q = { id: 0, text: customText.trim(), category: 'custom', time_pref: 'any' };
      } else if (paramId) {
        q = (await getQuestionById(paramId)) ?? (await pickQuestion());
      } else {
        q = await pickQuestion();
      }
      if (active) setQuestion(q);
    })();
    return () => {
      active = false;
    };
  }, [route.params?.questionId, route.params?.questionText]);

  const save = async (skipped: boolean) => {
    if (!question) return;
    if (!skipped && text.trim().length === 0) return;
    setSaving(true);
    await addResponse({
      date: todayStr(),
      time: nowTimeStr(),
      timestamp: Date.now(),
      question_id: question.id,
      question_text: question.text,
      answer: skipped ? '' : text.trim(),
      skipped: skipped ? 1 : 0,
    });
    setSaving(false);
    navigation.goBack();
  };

  if (!question) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.time}>{nowTimeStr()}</Text>
          <Text style={styles.question}>{question.text}</Text>
        </View>

        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={t('home:answer.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
            value={text}
            onChangeText={setText}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={() => save(true)}
            disabled={saving}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>{t('common:skip')}</Text>
          </Pressable>
          <View style={styles.flex}>
            <Button
              title={t('common:save')}
              onPress={() => save(false)}
              loading={saving}
              disabled={text.trim().length === 0}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { padding: spacing.lg },
  time: { fontSize: font.small, fontWeight: '700', color: colors.primary },
  question: {
    fontSize: font.heading,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
    lineHeight: 30,
  },
  inputWrap: { flex: 1, paddingHorizontal: spacing.lg },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: font.body,
    color: colors.text,
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  skipBtn: {
    height: 52,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontSize: font.body, color: colors.textSecondary, fontWeight: '600' },
});
