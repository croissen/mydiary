import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { OnboardingNavigator } from '../screens/onboarding/OnboardingNavigator';
import { TabNavigator } from './TabNavigator';
import { AnswerScreen } from '../screens/AnswerScreen';
import { DiaryScreen } from '../screens/DiaryScreen';
import { NoteEditorScreen } from '../screens/NoteEditorScreen';
import { DateNotesScreen } from '../screens/DateNotesScreen';
import { useSettings } from '../state/SettingsContext';
import { handleNotificationResponse, rescheduleAll } from '../notifications';
import { ensureDiaries } from '../services/diary';
import { getDiaryByDate, getResponsesByDate } from '../db';
import { todayStr } from '../utils/date';
import { AppSettings } from '../types';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation(['home', 'diary', 'common']);
  const { settings, ready } = useSettings();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const onboarded = settings.first_launch_completed;

  // Keep the latest settings reachable from listeners without re-subscribing.
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  const announceDiary = useCallback(
    (date: string) => {
      Alert.alert(t('home:diaryReady.title'), t('home:diaryReady.body'), [
        {
          text: t('home:diaryReady.view'),
          onPress: () => navRef.current?.navigate('Diary', { date }),
        },
        { text: t('common:close'), style: 'cancel' },
      ]);
    },
    [t]
  );

  // Auto-compile recent days that need it (recovers missed/failed days).
  // Announces freshly created diaries; AI failures stay silent here (the
  // compile-reminder tap surfaces a retry instead).
  const checkDiary = useCallback(async () => {
    if (!onboarded) return;
    const { created } = await ensureDiaries(settingsRef.current);
    if (created.length > 0) announceDiary(created[created.length - 1].date);
  }, [onboarded, announceDiary]);

  // Compile-reminder tap: open today's diary, or — if compiling failed despite
  // having responses — offer a retry instead of falsely saying "no records".
  const openTodayDiaryOrRetry = useCallback(async () => {
    const { failed } = await ensureDiaries(settingsRef.current);
    const today = todayStr();
    const diary = await getDiaryByDate(today);
    if (diary) {
      navRef.current?.navigate('Diary', { date: today });
      return;
    }
    const responses = await getResponsesByDate(today);
    const hasAnswers = responses.some(
      (r) => r.skipped === 0 && r.answer.trim().length > 0
    );
    if (failed || hasAnswers) {
      Alert.alert(t('home:diaryFailed.title'), t('home:diaryFailed.body'), [
        { text: t('common:retry'), onPress: () => openTodayDiaryOrRetry() },
        { text: t('common:cancel'), style: 'cancel' },
      ]);
    } else {
      Alert.alert(t('common:appName'), t('home:noDiaryToday'));
    }
  }, [t]);

  // Refresh the notification schedule (and the next 24h of random pings)
  // every time the app is opened with onboarding complete.
  useEffect(() => {
    if (ready && onboarded) {
      rescheduleAll(settings).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, onboarded]);

  // Auto-compile on launch and whenever the app returns to the foreground.
  useEffect(() => {
    if (!ready || !onboarded) return;
    checkDiary();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkDiary();
    });
    return () => sub.remove();
  }, [ready, onboarded, checkDiary]);

  // Notification interactions: inline reply is saved directly and snooze
  // reschedules (handled in the notifications module); a compile reminder tap
  // shows today's diary; a plain tap opens the in-app answer screen.
  useEffect(() => {
    if (!onboarded) return;
    const process = async (r: Notifications.NotificationResponse) => {
      const outcome = await handleNotificationResponse(r);
      if (outcome.handled) return;
      if (outcome.compile) {
        await openTodayDiaryOrRetry();
        return;
      }
      if (outcome.noteId) {
        navRef.current?.navigate('NoteEditor', { noteId: outcome.noteId });
        return;
      }
      navRef.current?.navigate(
        'Answer',
        outcome.question ? { questionText: outcome.question } : undefined
      );
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      process(r);
    });
    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) process(last);
    })();
    return () => sub.remove();
  }, [onboarded, t, openTodayDiaryOrRetry]);

  if (!ready) return null;

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator>
        {!onboarded ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingNavigator}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Tabs"
              component={TabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Answer"
              component={AnswerScreen}
              options={{ title: t('home:answer.title'), presentation: 'modal' }}
            />
            <Stack.Screen
              name="Diary"
              component={DiaryScreen}
              options={{ title: t('diary:title') }}
            />
            <Stack.Screen
              name="NoteEditor"
              component={NoteEditorScreen}
              options={{ title: '' }}
            />
            <Stack.Screen
              name="DateNotes"
              component={DateNotesScreen}
              options={{ title: '' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
