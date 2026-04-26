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
import { isReviewDue } from '../../src/api/client';
import { useGoals } from '../../src/hooks/useGoals';
import { useDailyReview } from '../../src/hooks/useDailyReview';
import { usePrevWeekStart, useWeeklyReview } from '../../src/hooks/useWeeklyReview';
import { useGameStats } from '../../src/hooks/useGameStats';
import { useAppStore } from '../../src/store/useAppStore';
import { formatDurationCompact, formatWeekRange, getWeekStart } from '../../src/utils/dates';
import type { GameStats } from '../../src/types';

const DRIFT_REASON_LABELS: Record<string, string> = {
  distracted: 'Got distracted',
  over_complex: 'Overcomplicated it',
  avoid_start: 'Avoided starting',
  too_much: 'Took on too much',
  interrupted: 'External interruption',
  low_energy: 'Energy crashed',
  lost_motive: 'Lost motivation',
  unclear_next: 'Unclear next step',
};

function getWhatBrokeValue(review: { whatDrifted: string; driftReasons: string[] }): string {
  const parts = [
    review.whatDrifted.trim(),
    ...review.driftReasons
      .map((reason) => DRIFT_REASON_LABELS[reason] ?? reason)
      .filter((reason) => reason.trim().length > 0),
  ].filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);

  return parts.join(', ');
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function WeeklyInspection({ stats }: { stats: GameStats }) {
  const weekStart = getWeekStart();
  const weekRows = stats.last7Days.filter((row) => row.date >= weekStart);
  const validDays = weekRows.filter((row) => row.met).length;
  const weekXp = weekRows.reduce((sum, row) => sum + row.xpEarned, 0);
  const passed = validDays >= 5;
  const inspectionColor = passed ? C.success : C.danger;
  const inspectionBg = passed ? C.successLight : '#FFF5F5';

  return (
    <View style={inspStyles.container}>
      <Text style={inspStyles.label}>WEEKLY INSPECTION</Text>
      <View style={[inspStyles.result, { backgroundColor: inspectionBg, borderColor: inspectionColor }]}>
        <Text style={[inspStyles.verdict, { color: inspectionColor }]}>
          {passed ? '✓ Pass' : '✗ Fail'}
        </Text>
        <Text style={inspStyles.detail}>
          {validDays}/5 valid days · {weekXp} xp this week
        </Text>
        <Text style={inspStyles.detail}>{stats.dailyRequirement.minimumCopy}</Text>
      </View>
      {stats.last7Days.length > 0 ? (
        <View style={inspStyles.dotRow}>
          {[...stats.last7Days]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((row) => (
              <View key={row.id} style={inspStyles.dotItem}>
                <View style={[inspStyles.dot, { backgroundColor: row.met ? C.success : C.danger }]} />
                <Text style={inspStyles.dotDate}>{row.date.slice(5)}</Text>
              </View>
            ))}
        </View>
      ) : null}
    </View>
  );
}

const inspStyles = StyleSheet.create({
  container: {
    marginTop: 24,
    gap: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1,
  },
  result: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  verdict: {
    fontSize: 18,
    fontWeight: '700',
  },
  detail: {
    fontSize: 13,
    color: '#555',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  dotItem: {
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotDate: {
    fontSize: 10,
    color: '#888',
  },
});

function SectionLabel({ children }: { children: string }) {
  return <Text style={sectionStyles.label}>{children}</Text>;
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={sectionStyles.fieldLabel}>{children}</Text>;
}

function InlineInput({
  value,
  onChangeText,
  placeholder,
  maxLength = 140,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <TextInput
      style={sectionStyles.inlineInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.textMuted}
      returnKeyType="done"
      maxLength={maxLength}
    />
  );
}

const sectionStyles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    marginBottom: 10,
    lineHeight: 21,
  },
  inlineInput: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    color: C.text,
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { activeGoal, setWeeklyFocusText, refresh: refreshGoals } = useGoals();
  const { stats: gameStats } = useGameStats(activeGoal?.id ?? null);
  const setReviewDue = useAppStore((state) => state.setReviewDue);
  const prevWeekOf = usePrevWeekStart();
  const { review, weekStats, saveReview, refresh: refreshReview } = useWeeklyReview(prevWeekOf);
  const { review: dailyReview, save: saveDailyReview } = useDailyReview();

  const [wins, setWins] = useState('');
  const [whatBroke, setWhatBroke] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [saved, setSaved] = useState(false);

  // Daily review state
  const [dailyWins, setDailyWins] = useState('');
  const [dailyDrift, setDailyDrift] = useState('');
  const [dailyTomorrow, setDailyTomorrow] = useState('');
  const [dailySaved, setDailySaved] = useState(false);
  const [showDailyReview, setShowDailyReview] = useState(false);

  useEffect(() => {
    if (dailyReview) {
      setDailyWins(dailyReview.wins);
      setDailyDrift(dailyReview.drift);
      setDailyTomorrow(dailyReview.tomorrowStep);
      setDailySaved(true);
    }
  }, [dailyReview]);

  const handleSaveDailyReview = useCallback(async () => {
    await saveDailyReview(dailyWins.trim(), dailyDrift.trim(), dailyTomorrow.trim());
    setDailySaved(true);
    setShowDailyReview(false);
  }, [saveDailyReview, dailyWins, dailyDrift, dailyTomorrow]);

  // Populate from existing review on mount / refresh
  useEffect(() => {
    if (review) {
      setWins(review.wins);
      setWhatBroke(getWhatBrokeValue(review));
      setAdjustment(review.nextWeekAdjustment);
      setNextFocus('');
      setSaved(true);
      return;
    }
    setWins('');
    setWhatBroke('');
    setAdjustment('');
    setNextFocus('');
    setSaved(false);
  }, [review]);

  useFocusEffect(
    useCallback(() => {
      void refreshGoals();
      void refreshReview();
      void (async () => {
        setReviewDue(await isReviewDue());
      })();
    }, [refreshGoals, refreshReview, setReviewDue])
  );

  const handleSave = () => {
    void (async () => {
      const didSave = await saveReview(
        wins.trim(),
        whatBroke.trim(),
        [],
        adjustment.trim()
      );
      if (!didSave) return;

      if (nextFocus.trim() && activeGoal) {
        await setWeeklyFocusText(activeGoal.id, nextFocus.trim());
      }

      setSaved(true);
      setReviewDue(false);
    })();
  };

  const canSave =
    wins.trim().length > 0 ||
    whatBroke.trim().length > 0 ||
    adjustment.trim().length > 0;

  const completionRate =
    weekStats.total > 0 ? Math.round((weekStats.done / weekStats.total) * 100) : null;
  const totalFocusSessions = weekStats.focusSessions.length;
  const completedFocusSessions = weekStats.focusSessions.filter(
    (session) => session.status === 'completed'
  ).length;
  const abandonedFocusSessions = weekStats.focusSessions.filter(
    (session) => session.status === 'abandoned'
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Header ──────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Review</Text>
          </View>

          {/* ─── Daily Shutdown Ritual ───────────────────────── */}
          <View style={styles.dailyCard}>
            <View style={styles.dailyCardHeader}>
              <View>
                <Text style={styles.dailyCardTitle}>Daily Shutdown</Text>
                <Text style={styles.dailyCardSub}>Today's quick reflection</Text>
              </View>
              {dailySaved ? (
                <View style={styles.dailyDoneBadge}>
                  <Text style={styles.dailyDoneText}>✓ Done</Text>
                </View>
              ) : null}
            </View>

            {showDailyReview ? (
              <View style={styles.dailyForm}>
                <Text style={styles.dailyQ}>What did you actually get done?</Text>
                <TextInput
                  style={styles.dailyInput}
                  value={dailyWins}
                  onChangeText={setDailyWins}
                  placeholder="Even small wins count..."
                  placeholderTextColor={C.textMuted}
                  maxLength={140}
                />
                <Text style={styles.dailyQ}>What pulled you off track?</Text>
                <TextInput
                  style={styles.dailyInput}
                  value={dailyDrift}
                  onChangeText={setDailyDrift}
                  placeholder="Be honest, not harsh..."
                  placeholderTextColor={C.textMuted}
                  maxLength={140}
                />
                <Text style={styles.dailyQ}>What's your first concrete step tomorrow?</Text>
                <TextInput
                  style={styles.dailyInput}
                  value={dailyTomorrow}
                  onChangeText={setDailyTomorrow}
                  placeholder="Name the exact action..."
                  placeholderTextColor={C.textMuted}
                  maxLength={140}
                />
                <View style={styles.dailyActions}>
                  <TouchableOpacity style={styles.dailyCancelBtn} onPress={() => setShowDailyReview(false)}>
                    <Text style={styles.dailyCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dailySaveBtn, !dailyWins.trim() && styles.dailySaveBtnDisabled]}
                    onPress={() => void handleSaveDailyReview()}
                    disabled={!dailyWins.trim()}
                  >
                    <Text style={styles.dailySaveBtnText}>Save Shutdown</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.dailyOpenBtn, dailySaved && styles.dailyOpenBtnSaved]}
                onPress={() => setShowDailyReview(true)}
              >
                <Text style={[styles.dailyOpenBtnText, dailySaved && styles.dailyOpenBtnTextSaved]}>
                  {dailySaved ? 'Edit today\'s shutdown' : 'Start daily shutdown →'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ─── Weekly divider ──────────────────────────────── */}
          <View style={styles.weeklyDivider}>
            <View style={styles.weeklyDividerLine} />
            <Text style={styles.weeklyDividerLabel}>WEEKLY REVIEW</Text>
            <View style={styles.weeklyDividerLine} />
          </View>
          <Text style={styles.weekLabel}>Week of {formatWeekRange(prevWeekOf)}</Text>

          {/* ─── Stats ───────────────────────────────────────── */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statNumber}>
                {weekStats.done}
                <Text style={styles.statTotal}>/{weekStats.total}</Text>
              </Text>
              <Text style={styles.statLabel}>tasks done</Text>
            </View>

            {completionRate !== null ? (
              <View style={[styles.statPill, styles.statPillAccent]}>
                <Text style={[styles.statNumber, styles.statNumberAccent]}>
                  {completionRate}%
                </Text>
                <Text style={[styles.statLabel, styles.statLabelAccent]}>completion</Text>
              </View>
            ) : (
              <View style={[styles.statPill, styles.statPillEmpty]}>
                <Text style={styles.statNumberMuted}>—</Text>
                <Text style={styles.statLabel}>no tasks yet</Text>
              </View>
            )}
          </View>

          {weekStats.focusSessions.length > 0 ? (
            <Text style={styles.focusSummary}>
              Focused {formatDurationCompact(weekStats.focusSeconds)} across {totalFocusSessions}
              {totalFocusSessions === 1 ? ' session' : ' sessions'}.
              {' '}
              {completedFocusSessions} completed, {abandonedFocusSessions} exited early.
            </Text>
          ) : null}

          {saved ? (
            <View style={styles.savedBadge}>
              <Text style={styles.savedText}>✓ Review saved</Text>
            </View>
          ) : null}

          {/* ─── 1. What moved the needle ─────────────────────── */}
          <View style={styles.section}>
            <SectionLabel>1 · WHAT WORKED</SectionLabel>
            <FieldLabel>What moved the needle this week?</FieldLabel>
            <InlineInput
              value={wins}
              onChangeText={setWins}
              placeholder="One win from this week"
            />
          </View>

          {/* ─── 2. What broke momentum ───────────────────────── */}
          <View style={styles.section}>
            <SectionLabel>2 · WHAT BROKE</SectionLabel>
            <FieldLabel>What pulled you off track?</FieldLabel>
            <InlineInput
              value={whatBroke}
              onChangeText={setWhatBroke}
              placeholder="Describe the friction in your own words..."
              maxLength={200}
            />
          </View>

          {/* ─── 3. One adjustment ────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel>3 · ONE ADJUSTMENT</SectionLabel>
            <FieldLabel>What changes specifically next week?</FieldLabel>
            <InlineInput
              value={adjustment}
              onChangeText={setAdjustment}
              placeholder="One concrete change — not aspirational"
            />
          </View>

          {/* ─── 4. Next week's focus ─────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel>4 · NEXT WEEK'S FOCUS</SectionLabel>
            {activeGoal ? (
              <Text style={styles.goalLink}>↳ {activeGoal.title}</Text>
            ) : null}
            <FieldLabel>What's the one thing to move this goal forward?</FieldLabel>
            <InlineInput
              value={nextFocus}
              onChangeText={setNextFocus}
              placeholder="Set next week's focus"
              maxLength={100}
            />
          </View>

          {/* ─── Save ─────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.saveButtonText}>
              {saved ? 'Update Review' : 'Complete Review'}
            </Text>
          </TouchableOpacity>

          {/* ─── Weekly Inspection ────────────────────────────── */}
          {gameStats ? (
            <WeeklyInspection stats={gameStats} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 60 },

  // Header
  header: { paddingTop: 16, marginBottom: 16 },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  focusSummary: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 14,
  },
  statPill: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  statPillAccent: {
    backgroundColor: C.accentLight,
    borderColor: 'transparent',
  },
  statPillEmpty: {
    backgroundColor: C.surfaceSecondary,
    borderColor: 'transparent',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    marginBottom: 1,
  },
  statTotal: {
    fontSize: 16,
    fontWeight: '500',
    color: C.textMuted,
  },
  statNumberAccent: { color: C.accent },
  statNumberMuted: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textMuted,
    marginBottom: 1,
  },
  statLabel: { fontSize: 12, color: C.textMuted },
  statLabelAccent: { color: C.accent },

  // Saved badge
  savedBadge: {
    backgroundColor: C.successLight,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  savedText: { fontSize: 13, color: C.success, fontWeight: '600' },

  // Sections
  section: { marginBottom: 24 },

  goalLink: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 8,
    fontStyle: 'italic',
  },

  // Daily shutdown card
  dailyCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  dailyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  dailyCardTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  dailyCardSub: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  dailyDoneBadge: { backgroundColor: C.successLight, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  dailyDoneText: { fontSize: 12, color: C.success, fontWeight: '600' },
  dailyForm: { gap: 10 },
  dailyQ: { fontSize: 14, fontWeight: '600', color: C.text },
  dailyInput: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: C.text,
  },
  dailyActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dailyCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: C.surfaceSecondary, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  dailyCancelText: { fontSize: 14, color: C.textSecondary },
  dailySaveBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 10,
    backgroundColor: C.accent, alignItems: 'center',
  },
  dailySaveBtnDisabled: { opacity: 0.4 },
  dailySaveBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  dailyOpenBtn: {
    backgroundColor: C.accentLight,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dailyOpenBtnSaved: { backgroundColor: C.surfaceSecondary },
  dailyOpenBtnText: { fontSize: 14, color: C.accent, fontWeight: '600' },
  dailyOpenBtnTextSaved: { color: C.textSecondary },

  // Weekly divider
  weeklyDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  weeklyDividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  weeklyDividerLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1 },
  weekLabel: { fontSize: 13, color: C.textSecondary, marginBottom: 16 },

  // Save
  saveButton: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
