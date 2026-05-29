import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

export function DatePickerField({ label, value, onChange }: Props) {
  const [show, setShow] = useState(false);
  const date = value ? dayjs(value).toDate() : new Date();

  const onPicked = (event: { type: string }, selected?: Date) => {
    setShow(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(dayjs(selected).format('YYYY-MM-DD'));
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
          mode="date"
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
    minWidth: 130,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  chipText: { fontSize: font.body, fontWeight: '700', color: colors.primary },
});
