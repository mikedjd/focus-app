import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../src/constants/colors';
import { useGoals } from '../../src/hooks/useGoals';
import { useGameStats } from '../../src/hooks/useGameStats';
import { calculateXpProgress, getBuildDecayLevel, getDaysUntil } from '../../src/utils/buildProgress';
import { formatShortDate } from '../../src/utils/dates';
import type { DailyXpRow, GoalPerformanceStatus } from '../../src/types';

const STATUS_LABELS: Record<GoalPerformanceStatus, string> = {
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Behind',
  decaying: 'Decaying',
};

const STATUS_COLORS: Record<GoalPerformanceStatus, string> = {
  ahead: C.success,
  on_track: C.accent,
  behind: '#E67700',
  decaying: C.danger,
};

const TIER_GUIDE: Array<[number, number, string]> = [
  [1, 5, 'Quick action'],
  [2, 15, 'Standard task'],
  [3, 40, 'Meaningful output'],
  [4, 100, 'High-leverage deliverable'],
  [5, 300, 'Mission-critical work'],
];

function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: pct, backgroundColor: color }]} />
    </View>
  );
}

function DayDot({ row }: { row: DailyXpRow }) {
  return (
    <View style={styles.dayDot}>
      <View style={[styles.dot, { backgroundColor: row.met ? C.success : C.danger }]} />
      <Text style={styles.dotLabel}>{row.date.slice(5)}</Text>
      <Text style={styles.dotXp}>{row.xpEarned > 0 ? `${row.xpEarned}xp` : '—'}</Text>
    </View>
  );
}

export default function BuildScreen() {
  const { activeGoal } = useGoals();
  const { stats, loading } = useGameStats(activeGoal?.id ?? null);

  if (!activeGoal) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No active goal</Text>
          <Text style={styles.emptySubtitle}>Set a goal in the Goal tab to start building.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading || !stats) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptySubtitle}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const xpTotal = activeGoal.xpTotal || stats.totalXp;
  const xpTarget = activeGoal.xpTarget || stats.targetXp;
  const buildHealth = stats.buildHealth ?? activeGoal.buildHealth ?? 100;
  const xpProgress = calculateXpProgress(xpTotal, xpTarget);
  const decayLevel = getBuildDecayLevel(buildHealth);
  const healthColor = decayLevel === 'healthy' ? C.success : decayLevel === 'decay' ? '#E67700' : C.danger;
  const perfStatus: GoalPerformanceStatus = activeGoal.performanceStatus ?? 'on_track';
  const statusColor = STATUS_COLORS[perfStatus];
  const statusLabel = STATUS_LABELS[perfStatus];
  const sortedDays = [...stats.last7Days].sort((a, b) => a.date.localeCompare(b.date));
  const daysUntil = getDaysUntil(activeGoal.targetDate);
  const startDate = activeGoal.startDate
    ? formatShortDate(activeGoal.startDate)
    : formatShortDate(new Date(activeGoal.createdAt).toISOString().slice(0, 10));
  const targetDate = activeGoal.targetDate ? formatShortDate(activeGoal.targetDate) : 'No date';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Build</Text>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Main build card */}
        <View style={[styles.card, decayLevel !== 'healthy' && { borderColor: healthColor }]}>
          <Text style={styles.goalTitle} numberOfLines={2}>{activeGoal.title}</Text>
          <Text style={styles.phaseLabel}>
            {`Phase ${activeGoal.difficultyPhase} · ${stats.dailyRequirement.phaseName}`}
          </Text>

          {decayLevel !== 'healthy' ? (
            <View style={[styles.damageBanner, decayLevel === 'severe' && { backgroundColor: C.dangerLight, borderColor: '#FFC9C9' }]}>
              <Text style={[styles.damageBannerText, decayLevel === 'severe' && { color: C.danger }]}>
                Build needs recovery — complete a recovery task
              </Text>
            </View>
          ) : null}

          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>XP progress</Text>
              <Text style={styles.progressValue}>{xpTotal} / {xpTarget} XP</Text>
            </View>
            <ProgressBar value={xpProgress} color={C.accent} />

            <View style={[styles.progressRow, { marginTop: 14 }]}>
              <Text style={styles.progressLabel}>Build health</Text>
              <Text style={[styles.progressValue, { color: healthColor }]}>{buildHealth} / 100</Text>
            </View>
            <ProgressBar value={buildHealth / 100} color={healthColor} />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaCellValue}>{stats.currentStreak}</Text>
              <Text style={styles.metaCellLabel}>day streak</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCell}>
              <Text style={styles.metaCellValue}>{startDate}</Text>
              <Text style={styles.metaCellLabel}>started</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCell}>
              <Text style={styles.metaCellValue}>
                {daysUntil !== null ? (daysUntil < 0 ? `${Math.abs(daysUntil)}d over` : `${daysUntil}d left`) : targetDate}
              </Text>
              <Text style={styles.metaCellLabel}>{daysUntil !== null ? 'remaining' : 'target'}</Text>
            </View>
          </View>
        </View>

        {/* Last 7 days */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Last 7 days</Text>
          {sortedDays.length > 0 ? (
            <>
              <View style={styles.dotsRow}>
                {sortedDays.map((row) => <DayDot key={row.id} row={row} />)}
              </View>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: C.success }]} />
                  <Text style={styles.legendText}>Met</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: C.danger }]} />
                  <Text style={styles.legendText}>Missed</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptySubtitle}>Complete tasks to start tracking daily XP.</Text>
          )}
        </View>

        {/* Tier guide */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tier guide</Text>
          {TIER_GUIDE.map(([tier, xp, label]) => (
            <View key={tier} style={styles.tierRow}>
              <Text style={styles.tierBadge}>T{tier}</Text>
              <Text style={styles.tierLabel}>{label}</Text>
              <Text style={styles.tierXp}>+{xp} xp</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  screenTitle: { fontSize: 28, fontWeight: '700', color: C.text },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  emptySubtitle: { fontSize: 14, color: C.textSecondary },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  goalTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.4, lineHeight: 26 },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  damageBanner: {
    backgroundColor: '#FFF4E6',
    borderColor: '#FFD8A8',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  damageBannerText: {
    color: '#C05621',
    fontSize: 12,
    fontWeight: '700',
  },
  progressSection: { gap: 6 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
  },
  barTrack: {
    height: 8,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  barFill: { height: 8, borderRadius: 4 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  metaCell: { flex: 1, alignItems: 'center', gap: 2 },
  metaDivider: { width: 1, height: 28, backgroundColor: C.border },
  metaCellValue: { fontSize: 14, fontWeight: '800', color: C.text },
  metaCellLabel: { fontSize: 10, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  section: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dotsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dayDot: { alignItems: 'center', gap: 3, minWidth: 36 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLabel: { fontSize: 10, color: C.textSecondary },
  dotXp: { fontSize: 10, color: C.textMuted },
  legendRow: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: C.textSecondary },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierBadge: { fontSize: 12, fontWeight: '700', color: C.accent, width: 24 },
  tierLabel: { flex: 1, fontSize: 13, color: C.text },
  tierXp: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
});
