import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HomeScreen } from '../screens/HomeScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme';
import { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, string> = {
  Home: '🏠',
  Calendar: '🗓️',
  Notes: '📝',
  Settings: '⚙️',
};

export function TabNavigator() {
  const { t } = useTranslation('common');
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
            {ICONS[route.name]}
          </Text>
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('tabs.home') }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: t('tabs.calendar') }}
      />
      <Tab.Screen
        name="Notes"
        component={NotesScreen}
        options={{ title: t('tabs.notes') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('tabs.settings') }}
      />
    </Tab.Navigator>
  );
}
