import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { DatePickerField } from '../components/DatePickerField';
import { getAllDiaries, getDiaryDates, getNotes } from '../db';
import { getHolidays } from '../services/holidays';
import { getDayColors, setDayColor } from '../services/dayColors';
import {
  HighlightRange,
  addHighlight,
  colorForDate,
  getHighlights,
  removeHighlight,
} from '../services/highlights';
import { colors, font, radius, spacing } from '../theme';
import { DiaryRow } from '../types';
import { formatLongDate, todayStr } from '../utils/date';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const NOTE_DOT = '#C9A227'; // dark goldenrod — distinct from the pale highlighter

const HL_COLORS: { key: string; color: string }[] = [
  { key: 'yellow', color: 'rgba(255,224,82,0.55)' },
  { key: 'pink', color: 'rgba(255,150,185,0.45)' },
  { key: 'green', color: 'rgba(150,220,150,0.45)' },
  { key: 'blue', color: 'rgba(140,195,255,0.45)' },
];

export function CalendarScreen() {
  const { t } = useTranslation(['calendar', 'common']);
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<'monthly' | 'list'>('monthly');
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set());
  const [noteDates, setNoteDates] = useState<Set<string>>(new Set());
  const [diaries, setDiaries] = useState<DiaryRow[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [dayColors, setDayColors] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<HighlightRange[]>([]);

  const [dateMenu, setDateMenu] = useState<string | null>(null);
  const [hlSheet, setHlSheet] = useState(false);
  const [hlStart, setHlStart] = useState(todayStr());
  const [hlEnd, setHlEnd] = useState(todayStr());
  const [hlColor, setHlColor] = useState(HL_COLORS[0].color);
  const [hlLabel, setHlLabel] = useState('');

  const load = useCallback(async () => {
    const [dates, all, dc, notes, hl] = await Promise.all([
      getDiaryDates(),
      getAllDiaries(),
      getDayColors(),
      getNotes(),
      getHighlights(),
    ]);
    setDiaryDates(new Set(dates));
    setDiaries(all);
    setDayColors(dc);
    setNoteDates(
      new Set(notes.filter((n) => n.note_date).map((n) => n.note_date))
    );
    setHighlights(hl);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    getHolidays(month.year()).then(setHolidays).catch(() => {});
  }, [month]);

  const weekdays = t('common:weekdays', { returnObjects: true }) as string[];
  const monthLabel = `${month.year()}년 ${month.month() + 1}월`;

  const daysInMonth = month.daysInMonth();
  const firstWeekday = month.day();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(month.date(d).format('YYYY-MM-DD'));
  }

  const isHoliday = (date: string) => dayColors[date] === 'red';

  const toggleHoliday = async (date: string) => {
    await setDayColor(date, isHoliday(date) ? null : 'red');
    setDateMenu(null);
    load();
  };

  // Number color: user holiday tag / public holiday → red; weekend colors.
  const dayColor = (date: string): string => {
    if (isHoliday(date) || holidays.has(date)) return colors.danger;
    const dow = dayjs(date).day();
    if (dow === 0) return colors.danger;
    if (dow === 6) return colors.primary;
    return colors.text;
  };

  const onAddHighlight = async () => {
    if (!hlLabel.trim()) return;
    await addHighlight(hlStart, hlEnd, hlColor, hlLabel.trim());
    setHlLabel('');
    load();
  };

  // Schedules overlapping the visible month (for the bottom list), max 4.
  const monthStart = month.format('YYYY-MM-DD');
  const monthEnd = month.endOf('month').format('YYYY-MM-DD');
  const monthSchedules = highlights
    .filter((h) => h.start <= monthEnd && h.end >= monthStart)
    .slice(0, 4);
  const onRemoveHighlight = async (id: string) => {
    await removeHighlight(id);
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('calendar:title')}</Text>
        <View style={styles.tabsRow}>
          <View style={styles.tabs}>
            {(['monthly', 'list'] as const).map((tb) => (
              <Pressable
                key={tb}
                onPress={() => setTab(tb)}
                style={[styles.tab, tab === tb && styles.tabActive]}
              >
                <Text
                  style={[styles.tabText, tab === tb && styles.tabTextActive]}
                >
                  {t(`calendar:${tb}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setHlSheet(true)} style={styles.hlBtn}>
            <Text style={styles.hlBtnText}>🖍 {t('calendar:highlighter')}</Text>
          </Pressable>
        </View>
      </View>

      {tab === 'monthly' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.monthNav}>
            <Pressable
              onPress={() => setMonth((m) => m.subtract(1, 'month'))}
              style={styles.navBtn}
            >
              <Text style={styles.navText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              onPress={() => setMonth((m) => m.add(1, 'month'))}
              style={styles.navBtn}
            >
              <Text style={styles.navText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekHeader}>
            {weekdays.map((w, i) => (
              <Text
                key={i}
                style={[
                  styles.weekday,
                  i === 0 && { color: colors.danger },
                  i === 6 && { color: colors.primary },
                ]}
              >
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((date, i) => {
              if (!date) return <View key={i} style={styles.cell} />;
              const isToday = date === todayStr();
              const hl = colorForDate(highlights, date);
              return (
                <Pressable
                  key={i}
                  style={styles.cell}
                  onPress={() => setDateMenu(date)}
                >
                  {hl && (
                    <View
                      pointerEvents="none"
                      style={[styles.hlBand, { backgroundColor: hl }]}
                    />
                  )}
                  <View
                    style={[styles.dayCircle, isToday && styles.todayCircle]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: dayColor(date) },
                        isToday && styles.todayText,
                      ]}
                    >
                      {dayjs(date).date()}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {diaryDates.has(date) && (
                      <View
                        style={[styles.dot, { backgroundColor: colors.primary }]}
                      />
                    )}
                    {noteDates.has(date) && (
                      <View style={[styles.dot, { backgroundColor: NOTE_DOT }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {monthSchedules.length > 0 && (
            <View style={styles.scheduleBox}>
              {monthSchedules.map((h) => (
                <View key={h.id} style={styles.scheduleRow}>
                  <View
                    style={[styles.scheduleSwatch, { backgroundColor: h.color }]}
                  />
                  <Text style={styles.scheduleText} numberOfLines={1}>
                    {h.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {diaries.length === 0 ? (
            <Text style={styles.empty}>{t('calendar:empty')}</Text>
          ) : (
            diaries.map((d) => (
              <Pressable
                key={d.id}
                style={styles.listCard}
                onPress={() => navigation.navigate('Diary', { date: d.date })}
              >
                <Text style={styles.listDate}>{formatLongDate(d.date)}</Text>
                <Text style={styles.listSnippet} numberOfLines={2}>
                  {d.content}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* Date action menu (replaces the old Alert) */}
      <Sheet
        visible={!!dateMenu}
        title={dateMenu ? formatLongDate(dateMenu) : ' '}
        onClose={() => setDateMenu(null)}
      >
        {dateMenu && (
          <>
            <MenuItem
              label={t('calendar:viewDiary')}
              onPress={() => {
                const d = dateMenu;
                setDateMenu(null);
                if (diaryDates.has(d)) navigation.navigate('Diary', { date: d });
              }}
            />
            <MenuItem
              label={t('calendar:viewNotes')}
              onPress={() => {
                const d = dateMenu;
                setDateMenu(null);
                navigation.navigate('DateNotes', { date: d });
              }}
            />
            <MenuItem
              label={
                isHoliday(dateMenu)
                  ? t('calendar:unsetHoliday')
                  : t('calendar:setHoliday')
              }
              onPress={() => toggleHoliday(dateMenu)}
            />
            <Button
              title={t('common:cancel')}
              variant="ghost"
              onPress={() => setDateMenu(null)}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}
      </Sheet>

      {/* Highlighter sheet */}
      <Sheet
        visible={hlSheet}
        title={t('calendar:highlighter')}
        onClose={() => setHlSheet(false)}
      >
        <Text style={styles.hint}>{t('calendar:highlighterHint')}</Text>
        <TextInput
          style={styles.labelInput}
          value={hlLabel}
          onChangeText={setHlLabel}
          placeholder={t('calendar:schedulePlaceholder')}
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.colorRow}>
          {HL_COLORS.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => setHlColor(c.color)}
              style={[
                styles.swatch,
                { backgroundColor: c.color },
                hlColor === c.color && styles.swatchActive,
              ]}
            />
          ))}
        </View>
        <View style={styles.hlRow}>
          <DatePickerField
            label={t('calendar:from')}
            value={hlStart}
            onChange={setHlStart}
          />
        </View>
        <View style={styles.hlRow}>
          <DatePickerField
            label={t('calendar:to')}
            value={hlEnd}
            onChange={setHlEnd}
          />
        </View>
        <Button
          title={t('calendar:addHighlight')}
          onPress={onAddHighlight}
          style={{ marginTop: spacing.sm }}
        />

        {highlights.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            {highlights.map((h) => (
              <View key={h.id} style={styles.hlItem}>
                <View style={[styles.hlBar, { backgroundColor: h.color }]} />
                <Text style={styles.hlItemText} numberOfLines={1}>
                  {h.label}  ·  {h.start}~{h.end}
                </Text>
                <Pressable
                  onPress={() => onRemoveHighlight(h.id)}
                  style={styles.delBtn}
                >
                  <Text style={styles.delText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}
    >
      <Text style={styles.menuText}>{label}</Text>
    </Pressable>
  );
}

const CELL = `${100 / 7}%`;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.card,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  hlBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.card,
  },
  hlBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: font.small },
  body: { padding: spacing.lg },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navBtn: { padding: spacing.sm, paddingHorizontal: spacing.lg },
  navText: { fontSize: 28, color: colors.primary, fontWeight: '700' },
  monthLabel: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  weekHeader: { flexDirection: 'row' },
  weekday: {
    width: CELL as unknown as number,
    textAlign: 'center',
    fontSize: font.tiny,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: CELL as unknown as number,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hlBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
    bottom: 8,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: { backgroundColor: colors.primaryLight },
  dayText: { fontSize: font.small, color: colors.text },
  todayText: { fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 3, height: 8, marginTop: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  listDate: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  listSnippet: { fontSize: font.small, color: colors.textSecondary, lineHeight: 20 },
  menuItem: { paddingVertical: spacing.md },
  menuPressed: { opacity: 0.6 },
  menuText: { fontSize: font.body, color: colors.text },
  hint: { fontSize: font.tiny, color: colors.textSecondary, marginBottom: spacing.md },
  labelInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: font.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  scheduleBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  scheduleSwatch: { width: 14, height: 14, borderRadius: 4, marginRight: spacing.sm },
  scheduleText: { flex: 1, fontSize: font.small, color: colors.text },
  colorRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: colors.text },
  hlRow: { marginBottom: spacing.md },
  hlItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  hlBar: { width: 24, height: 16, borderRadius: 4, marginRight: spacing.md },
  hlItemText: { flex: 1, fontSize: font.small, color: colors.text },
  delBtn: { padding: spacing.sm },
  delText: { color: colors.textMuted, fontSize: font.body },
});
