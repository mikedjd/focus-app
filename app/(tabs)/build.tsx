import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../src/constants/colors';
import { useGoals } from '../../src/hooks/useGoals';
import { useGameStats } from '../../src/hooks/useGameStats';
import { BuildVisual } from '../../src/components/build/BuildVisual';
import type { DailyXpRow } from '../../src/types';

function DayDot({ row }: { row: DailyXpRow }) {
  const dotColor = row.met ? C.success : C.danger;
  const label = row.date.slice(5); // MM-DD
  return (
    <View style={styles.dayDot}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.dotLabel}>{label}</Text>
      <Text style={styles.dotXp}>{row.xpEarned}xp</Text>
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

  const sortedDays = [...stats.last7Days].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Build</Text>

        <BuildVisual stats={stats} goalTitle={activeGoal.title} />

        {sortedDays.length > 0 ? (
          <View style={styles.historyBlock}>
            <Text style={styles.sectionLabel}>Last 7 days</Text>
            <View style={styles.dotsRow}>
              {sortedDays.map((row) => (
                <DayDot key={row.id} row={row} />
              ))}
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
          </View>
        ) : (
          <View style={styles.historyBlock}>
            <Text style={styles.sectionLabel}>Last 7 days</Text>
            <Text style={styles.emptySubtitle}>Complete tasks to start tracking daily XP.</Text>
          </View>
        )}

        <View style={styles.tierGuide}>
          <Text style={styles.sectionLabel}>Tier guide</Text>
          {([
            [1, 5, 'Quick action / admin'],
            [2, 15, 'Standard task'],
            [3, 40, 'Meaningful output'],
            [4, 100, 'High-leverage deliverable'],
            [5, 300, 'Mission-critical breakthrough'],
          ] as [number, number, string][]).map(([tier, xp, label]) => (
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
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  emptySubtitle: { fontSize: 14, color: C.textSecondary, textAlign: 'center' },
  historyBlock: {
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
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayDot: {
    alignItems: 'center',
    gap: 3,
    minWidth: 36,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotLabel: {
    fontSize: 10,
    color: C.textSecondary,
  },
  dotXp: {
    fontSize: 10,
    color: C.textMuted,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 12,
    color: C.textSecondary,
  },
  tierGuide: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tierBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
    width: 24,
  },
  tierLabel: {
    flex: 1,
    fontSize: 13,
    color: C.text,
  },
  tierXp: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
  },
});
