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
import { dbIsReviewDue } from '../../src/db';
import { useGoals } from '../../src/hooks/useGoals';
import { usePrevWeekStart, useWeeklyReview } from '../../src/hooks/useWeeklyReview';
import { useAppStore } from '../../src/store/useAppStore';
import { formatWeekRange } from '../../src/utils/dates';

// ─── Drift reason chips ──────────────────────────────────────────────────────

interface DriftChip {
  id: string;
  label: string;
}

const DRIFT_CHIPS: DriftChip[] = [
  { id: 'distracted',     label: 'Got distracted' },
  { id: 'over_complex',   label: 'Overcomplicated it' },
  { id: 'avoid_start',    label: 'Avoided starting' },
  { id: 'too_much',       label: 'Took on too much' },
  { id: 'interrupted',    label: 'External interruption' },
  { id: 'low_energy',     label: 'Energy crashed' },
  { id: 'lost_motive',    label: 'Lost motivation' },
  { id: 'unclear_next',   label: 'Unclear next step' },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

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
  const setReviewDue = useAppStore((state) => state.setReviewDue);
  const prevWeekOf = usePrevWeekStart();
  const { review, weekStats, saveReview, refresh: refreshReview } = useWeeklyReview(prevWeekOf);

  const [wins, setWins] = useState('');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [otherDrift, setOtherDrift] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [adjustment, setAdjustment] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [saved, setSaved] = useState(false);

  // Populate from existing review on mount / refresh
  useEffect(() => {
    if (review) {
      setWins(review.wins);
      setSelectedReasons(review.driftReasons);
      // If there's legacy free-text drift that isn't a chip id, show it as "other"
      const legacyText = review.whatDrifted;
      if (legacyText && !review.driftReasons.length) {
        setOtherDrift(legacyText);
        setShowOtherInput(true);
      } else if (legacyText && !DRIFT_CHIPS.some((c) => c.id === legacyText)) {
        setOtherDrift(legacyText);
        setShowOtherInput(true);
      }
      setAdjustment(review.nextWeekAdjustment);
      setSaved(true);
    }
  }, [review]);

  useFocusEffect(
    useCallback(() => {
      refreshGoals();
      refreshReview();
      setReviewDue(dbIsReviewDue());
    }, [refreshGoals, refreshReview, setReviewDue])
  );

  const toggleReason = (id: string) => {
    setSelectedReasons((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toggleOther = () => {
    setShowOtherInput((prev) => {
      if (prev) setOtherDrift('');
      return !prev;
    });
  };

  const handleSave = () => {
    const whatDrifted = otherDrift.trim();
    const didSave = saveReview(
      wins.trim(),
      whatDrifted,
      selectedReasons,
      adjustment.trim()
    );
    if (!didSave) return;

    if (nextFocus.trim() && activeGoal) {
      setWeeklyFocusText(activeGoal.id, nextFocus.trim());
    }

    setSaved(true);
    setReviewDue(false);
  };

  const canSave =
    wins.trim().length > 0 ||
    selectedReasons.length > 0 ||
    otherDrift.trim().length > 0 ||
    adjustment.trim().length > 0;

  const completionRate =
    weekStats.total > 0 ? Math.round((weekStats.done / weekStats.total) * 100) : null;

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
            <Text style={styles.weekLabel}>Week of {formatWeekRange(prevWeekOf)}</Text>
          </View>

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

            <View style={styles.chipGrid}>
              {DRIFT_CHIPS.map((chip) => {
                const active = selectedReasons.includes(chip.id);
                return (
                  <TouchableOpacity
                    key={chip.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleReason(chip.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.chip, showOtherInput && styles.chipActive]}
                onPress={toggleOther}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, showOtherInput && styles.chipTextActive]}>
                  Other
                </Text>
              </TouchableOpacity>
            </View>

            {showOtherInput ? (
              <InlineInput
                value={otherDrift}
                onChangeText={setOtherDrift}
                placeholder="Describe what happened..."
                maxLength={200}
              />
            ) : null}
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
  weekLabel: { fontSize: 14, color: C.textSecondary },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
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

  // Drift chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.accentLight,
    borderColor: C.accent,
  },
  chipText: {
    fontSize: 14,
    color: C.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: C.accent,
    fontWeight: '600',
  },

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
