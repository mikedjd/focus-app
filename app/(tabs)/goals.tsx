import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateGoalSheet } from '../../src/components/goals/CreateGoalSheet';
import { EditFocusSheet } from '../../src/components/goals/EditFocusSheet';
import { EditGoalSheet } from '../../src/components/goals/EditGoalSheet';
import { isReviewDue } from '../../src/api/client';
import { C } from '../../src/constants/colors';
import { useGoals } from '../../src/hooks/useGoals';
import { useAppStore } from '../../src/store/useAppStore';
import { formatShortDate } from '../../src/utils/dates';

type ActiveSheet = 'create' | 'editGoal' | 'editFocus' | null;

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
          onPress: () => { void completeGoal(activeGoal.id); },
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
            <TouchableOpacity
              style={styles.setGoalButton}
              onPress={() => setActiveSheet('create')}
              activeOpacity={0.85}
            >
              <Text style={styles.setGoalButtonText}>Set a goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            {/* Goal title + edit */}
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>Active goal</Text>
              <TouchableOpacity onPress={() => setActiveSheet('editGoal')} hitSlop={12}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.goalTitle}>{activeGoal.title}</Text>

            <View style={styles.metaRow}>
              {activeGoal.targetDate ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Due {formatShortDate(activeGoal.targetDate)}</Text>
                </View>
              ) : null}
              {activeGoal.metric ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{activeGoal.metric}</Text>
                </View>
              ) : null}
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>Phase {activeGoal.difficultyPhase}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>Health {activeGoal.buildHealth}/100</Text>
              </View>
            </View>

            {/* Why it matters */}
            <View style={styles.divider} />
            <Text style={styles.cardLabel}>Why it matters</Text>
            {activeGoal.anchorWhy || activeGoal.why ? (
              <Text style={styles.bodyText}>{activeGoal.anchorWhy || activeGoal.why}</Text>
            ) : (
              <TouchableOpacity onPress={() => setActiveSheet('editGoal')} activeOpacity={0.7}>
                <Text style={styles.placeholder}>Add the real reason behind this goal →</Text>
              </TouchableOpacity>
            )}

            {/* Weekly focus */}
            <View style={styles.divider} />
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>This week's focus</Text>
              <TouchableOpacity onPress={() => setActiveSheet('editFocus')} hitSlop={12}>
                <Text style={styles.editLink}>{weeklyFocus ? 'Edit' : 'Set'}</Text>
              </TouchableOpacity>
            </View>
            {weeklyFocus ? (
              <Text style={styles.bodyText}>{weeklyFocus.focus}</Text>
            ) : (
              <TouchableOpacity onPress={() => setActiveSheet('editFocus')} activeOpacity={0.7}>
                <Text style={styles.placeholder}>What moves this goal forward this week? →</Text>
              </TouchableOpacity>
            )}

            {/* Complete */}
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
        onSubmit={(input) => {
          void createGoal(input);
          setActiveSheet(null);
        }}
      />
      <EditGoalSheet
        visible={activeSheet === 'editGoal'}
        goal={activeGoal}
        onClose={() => setActiveSheet(null)}
        onSubmit={(goalId, input) => void updateGoal(goalId, input)}
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
  screenTitle: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.5 },

  emptyState: { paddingTop: 20, gap: 8 },
  emptyHeadline: { fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 16, color: C.textSecondary, marginBottom: 20 },
  setGoalButton: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  setGoalButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },

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
    textTransform: 'uppercase',
  },
  editLink: { fontSize: 14, color: C.accent, fontWeight: '500' },
  goalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.3,
    lineHeight: 30,
    marginBottom: 12,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: { fontSize: 12, color: C.textSecondary, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  bodyText: { fontSize: 15, color: C.text, lineHeight: 22 },
  placeholder: { fontSize: 14, color: C.accent, lineHeight: 20 },
  completeLink: { fontSize: 14, color: C.textMuted, textAlign: 'center', paddingVertical: 2 },
});
