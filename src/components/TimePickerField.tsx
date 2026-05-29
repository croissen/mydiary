import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import { parseHM } from '../utils/date';

interface Props {
  label?: string;
  value: string; // HH:MM
  onChange: (hm: string) => void;
}

export function TimePickerField({ label, value, onChange }: Props) {
  const [show, setShow] = useState(false);

  const { hour, minute } = parseHM(value);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  const onPicked = (event: { type: string }, selected?: Date) => {
    setShow(false);
    if (event.type === 'dismissed' || !selected) return;
    const hm = `${String(selected.getHours()).padStart(2, '0')}:${String(
      selected.getMinutes()
    ).padStart(2, '0')}`;
    onChange(hm);
  };

  return (
    <View style={styles.row}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setShow(true)}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <Text style={styles.chipText}>{value}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPicked}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: font.body, color: colors.text },
  chip: {
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    minWidth: 84,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  chipText: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.primary,
  },
});
