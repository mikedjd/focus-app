import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Goal, WeeklyFocus } from '../../types';
import { C } from '../../constants/colors';

interface Props {
  activeGoal: Goal | null;
  weeklyFocus: WeeklyFocus | null;
  onPress: () => void;
}

export function GoalAnchorCard({ activeGoal, weeklyFocus, onPress }: Props) {
  if (!activeGoal) {
    return null;
  }

  return (
    <TouchableOpacity style={styles.goalAnchor} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <Text style={styles.goalLabel}>GOAL</Text>
        <Text style={styles.goalTitle} numberOfLines={1}>
          {activeGoal.title}
        </Text>
      </View>
      {activeGoal.anchorWhy ? (
        <Text style={styles.anchorText} numberOfLines={2}>
          {activeGoal.anchorWhy}
        </Text>
      ) : null}
      {weeklyFocus ? (
        <View style={styles.focusChip}>
          <Text style={styles.focusText} numberOfLines={1}>
            This week: {weeklyFocus.focus}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  goalAnchor: {
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1,
  },
  goalTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    letterSpacing: -0.2,
  },
  anchorText: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 19,
    marginTop: 8,
  },
  focusChip: {
    alignSelf: 'flex-start',
    backgroundColor: C.accentLight,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  focusText: {
    fontSize: 12,
    color: C.accent,
    fontWeight: '500',
  },
});
