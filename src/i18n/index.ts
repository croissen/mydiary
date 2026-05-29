import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import koCommon from './locales/ko/common.json';
import koOnboarding from './locales/ko/onboarding.json';
import koHome from './locales/ko/home.json';
import koDiary from './locales/ko/diary.json';
import koCalendar from './locales/ko/calendar.json';
import koSettings from './locales/ko/settings.json';
import koNotes from './locales/ko/notes.json';

import enCommon from './locales/en/common.json';
import enOnboarding from './locales/en/onboarding.json';
import enHome from './locales/en/home.json';
import enDiary from './locales/en/diary.json';
import enCalendar from './locales/en/calendar.json';
import enSettings from './locales/en/settings.json';
import enNotes from './locales/en/notes.json';

import jaCommon from './locales/ja/common.json';
import jaOnboarding from './locales/ja/onboarding.json';
import jaHome from './locales/ja/home.json';
import jaDiary from './locales/ja/diary.json';
import jaCalendar from './locales/ja/calendar.json';
import jaSettings from './locales/ja/settings.json';
import jaNotes from './locales/ja/notes.json';

export const NAMESPACES = [
  'common',
  'onboarding',
  'home',
  'diary',
  'calendar',
  'settings',
  'notes',
] as const;

const resources = {
  ko: {
    common: koCommon,
    onboarding: koOnboarding,
    home: koHome,
    diary: koDiary,
    calendar: koCalendar,
    settings: koSettings,
    notes: koNotes,
  },
  en: {
    common: enCommon,
    onboarding: enOnboarding,
    home: enHome,
    diary: enDiary,
    calendar: enCalendar,
    settings: enSettings,
    notes: enNotes,
  },
  ja: {
    common: jaCommon,
    onboarding: jaOnboarding,
    home: jaHome,
    diary: jaDiary,
    calendar: jaCalendar,
    settings: jaSettings,
    notes: jaNotes,
  },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: 'ko',
    fallbackLng: 'ko',
    ns: NAMESPACES as unknown as string[],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });
}

export default i18n;
