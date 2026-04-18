import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateGoalSheet } from '../../src/components/goals/CreateGoalSheet';
import { EditFocusSheet } from '../../src/components/goals/EditFocusSheet';
import { EditGoalSheet } from '../../src/components/goals/EditGoalSheet';
import { EditWhySheet } from '../../src/components/goals/EditWhySheet';
import { isReviewDue } from '../../src/api/client';
import { C } from '../../src/constants/colors';
import { useGoals } from '../../src/hooks/useGoals';
import { useAppStore } from '../../src/store/useAppStore';
import { formatShortDate } from '../../src/utils/dates';

type ActiveSheet = 'create' | 'editGoal' | 'editWhy' | 'editFocus' | null;

const SYSTEM_STEPS = [
  { n: '1', text: 'Define one goal' },
  { n: '2', text: 'Add why it matters' },
  { n: '3', text: 'Use it to anchor daily tasks' },
];

export default function GoalsScreen() {
  const {
    activeGoal,
    weeklyFocus,
    createGoal,
    updateGoal,
    completeGoal,
    setWeeklyFocusText,
    refresh,
  } = useGoals();
  const setReviewDue = useAppStore((state) => state.setReviewDue);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void (async () => {
        setReviewDue(await isReviewDue());
      })();
    }, [refresh, setReviewDue])
  );

  const handleCompleteGoal = () => {
    if (!activeGoal) return;
    Alert.alert(
      'Complete this goal?',
      "This will archive it. You'll need to set a new goal to continue tracking tasks.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'destructive',
          onPress: () => {
            void completeGoal(activeGoal.id);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Goal</Text>
        </View>

        {!activeGoal ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyHeadline}>One goal. One reason.</Text>
            <Text style={styles.emptySubtitle}>That's the system.</Text>

            <View style={styles.stepList}>
              {SYSTEM_STEPS.map((step) => (
                <View key={step.n} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{step.n}</Text>
                  </View>
                  <Text style={styles.stepText}>{step.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.setGoalButton}
              onPress={() => setActiveSheet('create')}
              activeOpacity={0.85}
            >
              <Text style={styles.setGoalButtonText}>Set a Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>ACTIVE GOAL</Text>
              <TouchableOpacity onPress={() => setActiveSheet('editGoal')} hitSlop={12}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.goalTitle}>{activeGoal.title}</Text>
            <Text style={styles.goalOutcome}>{activeGoal.targetOutcome}</Text>

            <View style={styles.metaRow}>
              {activeGoal.targetDate ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Target {formatShortDate(activeGoal.targetDate)}</Text>
                </View>
              ) : (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>No fixed date</Text>
                </View>
              )}
              {activeGoal.metric ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{activeGoal.metric}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.divider} />
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>WHY IT MATTERS</Text>
              <TouchableOpacity onPress={() => setActiveSheet('editWhy')} hitSlop={12}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            {activeGoal.anchorWhy ? (
              <Text style={styles.anchorText}>{activeGoal.anchorWhy}</Text>
            ) : (
              <TouchableOpacity onPress={() => setActiveSheet('editWhy')} activeOpacity={0.7}>
                <Text style={styles.whyPlaceholder}>Add the real reason behind this goal →</Text>
              </TouchableOpacity>
            )}

            <View style={styles.divider} />
            <Text style={styles.cardLabel}>COST OF DRIFT</Text>
            {activeGoal.anchorDrift ? (
              <Text style={styles.anchorText}>{activeGoal.anchorDrift}</Text>
            ) : (
              <TouchableOpacity onPress={() => setActiveSheet('editWhy')} activeOpacity={0.7}>
                <Text style={styles.whyPlaceholder}>Add the consequence of letting this slide →</Text>
              </TouchableOpacity>
            )}

            {(activeGoal.practicalReason || activeGoal.emotionalReason || activeGoal.costOfDrift) ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.cardLabel}>WHY STACK</Text>
                {activeGoal.practicalReason ? (
                  <View style={styles.stackRow}>
                    <Text style={styles.stackLabel}>Practical</Text>
                    <Text style={styles.stackText}>{activeGoal.practicalReason}</Text>
                  </View>
                ) : null}
                {activeGoal.emotionalReason ? (
                  <View style={styles.stackRow}>
                    <Text style={styles.stackLabel}>Emotional</Text>
                    <Text style={styles.stackText}>{activeGoal.emotionalReason}</Text>
                  </View>
                ) : null}
                {activeGoal.costOfDrift ? (
                  <View style={styles.stackRow}>
                    <Text style={styles.stackLabel}>Drift</Text>
                    <Text style={styles.stackText}>{activeGoal.costOfDrift}</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            <View style={styles.divider} />
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>THIS WEEK'S FOCUS</Text>
              <TouchableOpacity onPress={() => setActiveSheet('editFocus')} hitSlop={12}>
                <Text style={styles.editLink}>{weeklyFocus ? 'Edit' : 'Set'}</Text>
              </TouchableOpacity>
            </View>
            {weeklyFocus ? (
              <Text style={styles.focusText}>{weeklyFocus.focus}</Text>
            ) : (
              <TouchableOpacity onPress={() => setActiveSheet('editFocus')} activeOpacity={0.7}>
                <Text style={styles.whyPlaceholder}>What moves this goal forward this week? →</Text>
              </TouchableOpacity>
            )}

            {/* Complete action — anchored at bottom of card, secondary */}
            <View style={styles.divider} />
            <TouchableOpacity onPress={handleCompleteGoal} activeOpacity={0.7}>
              <Text style={styles.completeLink}>Mark goal complete</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <CreateGoalSheet
        visible={activeSheet === 'create'}
        onClose={() => setActiveSheet(null)}
        onSubmit={(input) => void createGoal(input)}
      />
      <EditGoalSheet
        visible={activeSheet === 'editGoal'}
        goal={activeGoal}
        onClose={() => setActiveSheet(null)}
        onSubmit={(goalId, input) => void updateGoal(goalId, input)}
      />
      <EditWhySheet
        visible={activeSheet === 'editWhy'}
        goal={activeGoal}
        onClose={() => setActiveSheet(null)}
        onSubmit={(goalId, input) => {
          if (!activeGoal || goalId !== activeGoal.id) return;
          void updateGoal(goalId, input);
        }}
      />
      <EditFocusSheet
        visible={activeSheet === 'editFocus'}
        goalId={activeGoal?.id}
        currentFocus={weeklyFocus?.focus}
        onClose={() => setActiveSheet(null)}
        onSubmit={(goalId, focus) => void setWeeklyFocusText(goalId, focus)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { paddingTop: 16, marginBottom: 20 },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.5,
  },

  // ─── Empty state ───────────────────────────────────────────────
  emptyState: {
    paddingTop: 20,
    paddingHorizontal: 4,
  },
  emptyHeadline: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 16,
    color: C.textSecondary,
    marginBottom: 28,
  },
  stepList: {
    gap: 14,
    marginBottom: 32,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
  },
  stepText: {
    fontSize: 16,
    color: C.text,
    fontWeight: '500',
  },
  setGoalButton: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  setGoalButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },

  // ─── Goal card ─────────────────────────────────────────────────
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1,
  },
  editLink: {
    fontSize: 14,
    color: C.accent,
    fontWeight: '500',
  },
  goalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.3,
    lineHeight: 30,
    marginBottom: 6,
  },
  goalOutcome: {
    fontSize: 15,
    color: C.textSecondary,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 14,
  },
  anchorText: {
    fontSize: 15,
    color: C.text,
    lineHeight: 22,
  },
  whyPlaceholder: {
    fontSize: 14,
    color: C.accent,
    lineHeight: 20,
  },
  stackRow: {
    marginTop: 12,
    gap: 4,
  },
  stackLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  stackText: {
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
  },
  focusText: {
    fontSize: 15,
    color: C.text,
    lineHeight: 22,
  },
  completeLink: {
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
    paddingVertical: 2,
  },
});
