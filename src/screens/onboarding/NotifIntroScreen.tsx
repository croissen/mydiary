import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useSettings } from '../../state/SettingsContext';
import { requestPermission } from '../../notifications';
import { colors, font, spacing } from '../../theme';
import { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotifIntro'>;

export function NotifIntroScreen({ navigation }: Props) {
  const { t } = useTranslation('onboarding');
  const { update } = useSettings();
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  const onAllow = async () => {
    setBusy(true);
    const granted = await requestPermission();
    await update({ notification_permission_granted: granted });
    setBusy(false);
    if (granted) {
      navigation.navigate('NotifTimes');
    } else {
      setDenied(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.emoji}>🔔</Text>
        <Text style={styles.title}>{t('notifIntro.title')}</Text>
        <Text style={styles.line}>{t('notifIntro.line1')}</Text>
        <Text style={styles.line}>{t('notifIntro.line2')}</Text>
        <Text style={styles.line}>{t('notifIntro.line3')}</Text>
        {denied && <Text style={styles.denied}>{t('notifIntro.denied')}</Text>}
      </View>
      <View style={styles.footer}>
        <Button title={t('notifIntro.allow')} onPress={onAllow} loading={busy} />
        {denied && (
          <Button
            title={t('notifIntro.continueAnyway')}
            variant="ghost"
            onPress={() => navigation.navigate('NotifTimes')}
            style={{ marginTop: spacing.sm }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emoji: { fontSize: 56, marginBottom: spacing.lg },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  line: {
    fontSize: font.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  denied: {
    fontSize: font.small,
    color: colors.warning,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footer: { padding: spacing.lg },
});
