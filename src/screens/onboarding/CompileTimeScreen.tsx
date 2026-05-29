import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { TimePickerField } from '../../components/TimePickerField';
import { useSettings } from '../../state/SettingsContext';
import { colors, font, radius, spacing } from '../../theme';
import { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CompileTime'>;

export function CompileTimeScreen({ navigation }: Props) {
  const { t } = useTranslation('onboarding');
  const { update } = useSettings();
  const [time, setTime] = useState('23:00');

  const onDone = async () => {
    await update({ diary_compile_time: time });
    navigation.navigate('Battery');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.emoji}>🌙</Text>
        <Text style={styles.title}>{t('compile.title')}</Text>
        <Text style={styles.subtitle}>{t('compile.subtitle')}</Text>
        <View style={styles.card}>
          <TimePickerField label={t('compile.label')} value={time} onChange={setTime} />
        </View>
      </View>
      <View style={styles.footer}>
        <Button title={t('common:done', { defaultValue: '완료' })} onPress={onDone} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: spacing.lg },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: font.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  footer: { padding: spacing.lg },
});
