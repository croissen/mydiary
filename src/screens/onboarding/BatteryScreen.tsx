import React, { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useSettings } from '../../state/SettingsContext';
import { getAllSettings } from '../../db';
import { rescheduleAll } from '../../notifications';
import { colors, font, spacing } from '../../theme';

export function BatteryScreen() {
  const { t } = useTranslation('onboarding');
  const { update } = useSettings();
  const [busy, setBusy] = useState(false);
  const isAndroid = Platform.OS === 'android';

  const finish = async () => {
    setBusy(true);
    await update({ first_launch_completed: true });
    const fresh = await getAllSettings();
    await rescheduleAll(fresh);
    // Root navigator switches to Tabs once first_launch_completed flips.
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.emoji}>🔋</Text>
        <Text style={styles.title}>
          {isAndroid ? t('battery.title') : t('battery.finish')}
        </Text>
        {isAndroid && (
          <>
            <Text style={styles.line}>{t('battery.line1')}</Text>
            <Text style={styles.line}>{t('battery.line2')}</Text>
            <Text style={styles.warn}>{t('battery.skipWarn')}</Text>
          </>
        )}
      </View>
      <View style={styles.footer}>
        {isAndroid && (
          <Button
            title={t('battery.openSettings')}
            variant="secondary"
            onPress={() => Linking.openSettings()}
            style={{ marginBottom: spacing.sm }}
          />
        )}
        <Button title={t('battery.finish')} onPress={finish} loading={busy} />
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
    marginBottom: spacing.lg,
  },
  line: {
    fontSize: font.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  warn: {
    fontSize: font.small,
    color: colors.warning,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footer: { padding: spacing.lg },
});
