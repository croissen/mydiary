import { NavigatorScreenParams } from '@react-navigation/native';

export type OnboardingStackParamList = {
  Welcome: undefined;
  NotifIntro: undefined;
  NotifTimes: undefined;
  CompileTime: undefined;
  Battery: undefined;
};

export type TabParamList = {
  Home: undefined;
  Calendar: undefined;
  Notes: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Tabs: NavigatorScreenParams<TabParamList>;
  Answer: { questionId?: number; questionText?: string } | undefined;
  Diary: { date: string };
  NoteEditor: { noteId: number };
  DateNotes: { date: string };
};
