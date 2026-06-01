import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/i18n';
import { getDb } from './src/db';
import { configureNotificationHandler } from './src/notifications';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SettingsProvider } from './src/state/SettingsContext';
import { AuthProvider } from './src/auth/AuthContext';
import { PurchasesProvider } from './src/purchases/PurchasesContext';
import { colors } from './src/theme';

configureNotificationHandler();

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch(() => setDbReady(true));
  }, []);

  if (!dbReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <PurchasesProvider>
      <AuthProvider>
        <SettingsProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SettingsProvider>
      </AuthProvider>
      </PurchasesProvider>
    </SafeAreaProvider>
  );
}
