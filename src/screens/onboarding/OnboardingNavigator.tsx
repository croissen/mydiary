import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { OnboardingStackParamList } from '../../navigation/types';
import { WelcomeScreen } from './WelcomeScreen';
import { NotifIntroScreen } from './NotifIntroScreen';
import { NotifTimesScreen } from './NotifTimesScreen';
import { CompileTimeScreen } from './CompileTimeScreen';
import { BatteryScreen } from './BatteryScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="NotifIntro" component={NotifIntroScreen} />
      <Stack.Screen name="NotifTimes" component={NotifTimesScreen} />
      <Stack.Screen name="CompileTime" component={CompileTimeScreen} />
      <Stack.Screen name="Battery" component={BatteryScreen} />
    </Stack.Navigator>
  );
}
