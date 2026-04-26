import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colors';
import type { GameStats } from '../../types';

const STAGE_LABELS: Record<number, string> = {
  1: 'Empty plot',
  2: 'Foundations',
  3: 'Structure up',
  4: 'Walls & roof',
  5: 'Mansion complete',
};

const STAGE_ICONS: Record<number, string> = {
  1: '░',
  2: '🏗',
  3: '🪵',
  4: '🏠',
  5: '🏛',
};

interface Props {
  stats: GameStats;
  goalTitle: string;
}

export function BuildVisual({ stats, goalTitle }: Props) {
  const { buildStage, totalXp, targetXp, currentStreak, healthScore, dailyRequirement, statusCopy } = stats;
  const xpProgress = targetXp > 0 ? Math.min(1, totalXp / targetXp) : 0;
  const healthColor = healthScore >= 70 ? C.success : healthScore >= 40 ? '#E67700' : C.danger;

  return (
    <View style={styles.container}>
      <Text style={styles.goalTitle} numberOfLines={1}>{goalTitle}</Text>
      <View style={styles.requirementBlock}>
        <Text style={styles.requirementPhase}>Phase {dailyRequirement.phase}: {dailyRequirement.phaseName}</Text>
        <Text style={styles.requirementCopy}>{statusCopy}</Text>
      </View>

      {/* Stage display */}
      <View style={styles.stageRow}>
        <Text style={styles.stageIcon}>{STAGE_ICONS[buildStage]}</Text>
        <View style={styles.stageInfo}>
          <Text style={styles.stageName}>{STAGE_LABELS[buildStage]}</Text>
          <Text style={styles.stageNumber}>Stage {buildStage} of 5</Text>
        </View>
      </View>

      {/* XP progress */}
      <View style={styles.metricBlock}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>XP</Text>
          <Text style={styles.metricValue}>{totalXp} / {targetXp}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(xpProgress * 100)}%`, backgroundColor: C.accent }]} />
        </View>
      </View>

      {/* Health */}
      <View style={styles.metricBlock}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Build health</Text>
          <Text style={[styles.metricValue, { color: healthColor }]}>{healthScore}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${healthScore}%`, backgroundColor: healthColor }]} />
        </View>
      </View>

      {/* Streak + expectation */}
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeValue}>{currentStreak}</Text>
          <Text style={styles.badgeLabel}>day streak</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeValue}>{dailyRequirement.tasksRequired}</Text>
          <Text style={styles.badgeLabel}>task minimum</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
  },
  goalTitle: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requirementBlock: {
    borderRadius: 12,
    backgroundColor: '#F4F7FF',
    borderWidth: 1,
    borderColor: '#D8E2FF',
    padding: 12,
    gap: 3,
  },
  requirementPhase: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
  },
  requirementCopy: {
    fontSize: 14,
    color: C.text,
    fontWeight: '600',
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stageIcon: {
    fontSize: 40,
    lineHeight: 48,
  },
  stageInfo: {
    flex: 1,
    gap: 2,
  },
  stageName: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
  },
  stageNumber: {
    fontSize: 13,
    color: C.textSecondary,
  },
  metricBlock: {
    gap: 6,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  barTrack: {
    height: 6,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  badge: {
    flex: 1,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  badgeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: C.text,
  },
  badgeLabel: {
    fontSize: 11,
    color: C.textSecondary,
    textAlign: 'center',
  },
});
