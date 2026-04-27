import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../src/constants/colors';
import { getTasksForWeek, isReviewDue, runWeeklyInspection } from '../../src/api/client';
import { useGoals } from '../../src/hooks/useGoals';
import { usePrevWeekStart, useWeeklyReview } from '../../src/hooks/useWeeklyReview';
import { useGameStats } from '../../src/hooks/useGameStats';
import { useAppStore } from '../../src/store/useAppStore';
import { formatWeekRange, getWeekStart } from '../../src/utils/dates';
import type { DailyTask, WeeklyInspection } from '../../src/types';

export default function ReviewScreen() {
  const { activeGoal, setWeeklyFocusText, refresh: refreshGoals } = useGoals();
  const { stats: gameStats, refresh: refreshStats } = useGameStats(activeGoal?.id ?? null);
  const setReviewDue = useAppStore((state) => state.setReviewDue);
  const prevWeekOf = usePrevWeekStart();
  const { review, weekStats, saveReview, refresh: refreshReview } = useWeeklyReview(prevWeekOf);

  // Inspection state
  const [weekTasks, setWeekTasks] = useState<DailyTask[]>([]);
  const [inspection, setInspection] = useState<WeeklyInspection | null>(null);
  const [running, setRunning] = useState(false);

  // Notes state
  const [wins, setWins] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const weekStart = getWeekStart();

  const refreshWeekTasks = useCallback(async () => {
    setWeekTasks(await getTasksForWeek(weekStart));
  }, [weekStart]);

  useEffect(() => {
    void refreshWeekTasks();
  }, [refreshWeekTasks]);

  useEffect(() => {
    if (review) {
      setWins(review.wins);
      setNextFocus('');
      setNotesSaved(true);
    } else {
      setWins('');
      setNextFocus('');
      setNotesSaved(false);
    }
  }, [review]);

  useFocusEffect(
    useCallback(() => {
      void refreshGoals();
      void refreshReview();
      void refreshWeekTasks();
      void (async () => {
        setReviewDue(await isReviewDue());
      })();
    }, [refreshGoals, refreshReview, refreshWeekTasks, setReviewDue])
  );

  const handleRunInspection = async () => {
    setRunning(true);
    const result = await runWeeklyInspection(weekStart);
    setInspection(result);
    await Promise.all([refreshGoals(), refreshWeekTasks()]);
    refreshStats();
    setRunning(false);
  };

  const handleSaveNotes = () => {
    void (async () => {
      const didSave = await saveReview(wins.trim(), '', [], '');
      if (!didSave) return;
      if (nextFocus.trim() && activeGoal) {
        await setWeeklyFocusText(activeGoal.id, nextFocus.trim());
      }
      setNotesSaved(true);
      setReviewDue(false);
    })();
  };

  // Inspection data — prefer the freshly-run result, fall back to last7Days
  const weekRows = (gameStats?.last7Days ?? []).filter((row) => row.date >= weekStart);
  const xpEarned = inspection?.xpEarned ?? weekRows.reduce((sum, r) => sum + r.xpEarned, 0);
  const tasksCompleted =
    inspection?.tasksCompleted ??
    weekTasks.filter((t) => t.goalId === activeGoal?.id && t.status === 'done').length;
  const hardTasksCompleted =
    inspection?.hardTasksCompleted ??
    weekTasks.filter((t) => t.goalId === activeGoal?.id && t.status === 'done' && (t.tier ?? 1) >= 3).length;
  const validDays = inspection?.validDays ?? weekRows.filter((r) => r.met).length;
  const healthChange = inspection?.buildHealthChange ?? 0;
  const inspectionResult = inspection?.result ?? null;
  const resultColor =
    inspectionResult === 'pass' ? C.success : inspectionResult === 'fail' ? C.danger : C.textSecondary;

  const canSaveNotes = wins.trim().length > 0 || nextFocus.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <Text style={styles.screenTitle}>Review</Text>
          </View>

          {/* ── Weekly Inspection ── */}
          <View style={styles.inspectionCard}>
            <View style={styles.inspectionTop}>
              <View style={styles.inspectionMeta}>
                <Text style={styles.sectionEyebrow}>Weekly Inspection</Text>
                <Text style={styles.weekRange}>{formatWeekRange(weekStart)}</Text>
                {activeGoal ? (
                  <Text style={styles.goalName} numberOfLines={1}>{activeGoal.title}</Text>
                ) : null}
              </View>
              {inspectionResult ? (
                <View style={[styles.resultBadge, { borderColor: resultColor }]}>
                  <Text style={[styles.resultText, { color: resultColor }]}>
                    {inspectionResult.toUpperCase()}
                  </Text>
                </View>
              ) : (
                <View style={styles.resultBadge}>
                  <Text style={styles.resultReady}>READY</Text>
                </View>
              )}
            </View>

            <View style={styles.metricsGrid}>
              <InspMetric label="XP earned" value={String(xpEarned)} />
              <InspMetric label="Tasks done" value={String(tasksCompleted)} />
              <InspMetric label="Hard tasks T3+" value={String(hardTasksCompleted)} />
              <InspMetric label="Valid days" value={`${validDays}/5`} />
              {inspectionResult ? (
                <InspMetric
                  label="Health change"
                  value={`${healthChange > 0 ? '+' : ''}${healthChange}`}
                  valueColor={healthChange > 0 ? C.success : C.danger}
                />
              ) : null}
              {activeGoal ? (
                <InspMetric label="Build health" value={`${activeGoal.buildHealth ?? 100}/100`} />
              ) : null}
            </View>

            {inspection?.recoveryTaskCreated ? (
              <View style={styles.recoveryBanner}>
                <Text style={styles.recoveryBannerText}>Recovery task added to today's list.</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.runButton, running && styles.runButtonDisabled]}
              onPress={() => void handleRunInspection()}
              disabled={running || !activeGoal}
              activeOpacity={0.85}
            >
              <Text style={styles.runButtonText}>{running ? 'Running…' : 'Run inspection'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Weekly Notes ── */}
          <View style={styles.notesCard}>
            <Text style={styles.sectionEyebrow}>
              Weekly Notes · {formatWeekRange(prevWeekOf)}
            </Text>

            {notesSaved ? (
              <View style={styles.savedBadge}>
                <Text style={styles.savedText}>Saved</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>What moved the needle this week?</Text>
              <TextInput
                style={styles.fieldInput}
                value={wins}
                onChangeText={setWins}
                placeholder="One win or key action"
                placeholderTextColor={C.textMuted}
                maxLength={160}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Next week's focus</Text>
              {activeGoal ? (
                <Text style={styles.goalLink}>↳ {activeGoal.title}</Text>
              ) : null}
              <TextInput
                style={styles.fieldInput}
                value={nextFocus}
                onChangeText={setNextFocus}
                placeholder="What's the one thing to move this forward?"
                placeholderTextColor={C.textMuted}
                maxLength={100}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, !canSaveNotes && styles.saveButtonDisabled]}
              onPress={handleSaveNotes}
              disabled={!canSaveNotes}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>{notesSaved ? 'Update notes' : 'Save notes'}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InspMetric({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.inspMetric}>
      <Text style={[styles.inspMetricValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.inspMetricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 16 },
  header: { paddingTop: 16 },
  screenTitle: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.5 },

  // Inspection card
  inspectionCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 14,
  },
  inspectionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  inspectionMeta: { flex: 1, gap: 3 },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  weekRange: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  goalName: { fontSize: 14, fontWeight: '700', color: C.text, marginTop: 2 },
  resultBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderColor: C.border,
    alignSelf: 'flex-start',
  },
  resultText: { fontSize: 13, fontWeight: '800' },
  resultReady: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inspMetric: {
    width: '47%',
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  inspMetricValue: { fontSize: 20, fontWeight: '900', color: C.text },
  inspMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  recoveryBanner: {
    backgroundColor: '#FFF4E6',
    borderColor: '#FFD8A8',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  recoveryBannerText: { fontSize: 13, color: '#C05621', fontWeight: '700' },
  runButton: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  runButtonDisabled: { opacity: 0.4 },
  runButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Notes card
  notesCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 16,
  },
  savedBadge: {
    backgroundColor: C.successLight,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  savedText: { fontSize: 12, color: C.success, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: C.text, lineHeight: 21 },
  goalLink: { fontSize: 13, color: C.textSecondary, fontStyle: 'italic' },
  fieldInput: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    color: C.text,
  },
  saveButton: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});
