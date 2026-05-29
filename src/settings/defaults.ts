import { AppSettings, Question } from '../types';
import questionsData from '../data/questions.json';

export const BUNDLED_QUESTIONS = questionsData as Question[];

export const DEFAULT_SETTINGS: AppSettings = {
  notification_times: ['09:00', '12:30', '15:00', '18:00', '22:00'],
  slot_enabled: [true, true, true, true, true],
  slot_questions: [null, null, null, null, null],
  random_extra_count: 2,
  diary_compile_time: '23:00',
  ai_tone: 'casual',
  ai_custom_style: '',
  question_pool: BUNDLED_QUESTIONS,
  quiet_hours: { start: '00:00', end: '07:00' },
  language: 'ko',
  first_launch_completed: false,
  notification_permission_granted: false,
};
