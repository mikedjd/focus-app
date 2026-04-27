import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../src/constants/colors';
import { getTasksForWeek, runWeeklyInspection } from '../../src/api/client';
import { useGoals } from '../../src/hooks/useGoals';
import { useGameStats } from '../../src/hooks/useGameStats';
import { formatShortDate, getWeekStart } from '../../src/utils/dates';
import type { DailyTask, WeeklyInspection } from '../../src/types';

function resultColor(result?: WeeklyInspection['result']): string {
  if (result === 'pass') return C.success;
  if (result === 'fail') return C.danger;
  return '#E67700';
}

export default function WeeklyInspectionScreen() {
  const weekStart = useMemo(() => getWeekStart(), []);
  const weekEnd = useMemo(() => {
    const [year, month, day] = weekStart.split('-').map(Number);
    const date = new Date(year, month - 1, day + 6);
    return date.toISOString().slice(0, 10);
  }, [weekStart]);
  const { activeGoal, refresh: refreshGoal } = useGoals();
  const { stats, refresh: refreshStats } = useGameStats(activeGoal?.id ?? null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [inspection, setInspection] = useState<WeeklyInspection | null>(null);
  const [running, setRunning] = useState(false);

  const refreshTasks = useCallback(async () => {
    setTasks(await getTasksForWeek(weekStart));
  }, [weekStart]);

  React.useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const weekRows = (stats?.last7Days ?? []).filter((row) => row.date >= weekStart && row.date <= weekEnd);
  const xpEarned = inspection?.xpEarned ?? weekRows.reduce((sum, row) => sum + row.xpEarned, 0);
  const tasksCompleted =
    inspection?.tasksCompleted ??
    tasks.filter((task) => task.goalId === activeGoal?.id && task.status === 'done').length;
  const hardTasksCompleted =
    inspection?.hardTasksCompleted ??
    tasks.filter((task) => task.goalId === activeGoal?.id && task.status === 'done' && (task.tier ?? 1) >= 3).length;
  const validDays = inspection?.validDays ?? weekRows.filter((row) => row.met).length;
  const buildHealthChange = inspection?.buildHealthChange ?? 0;

  const handleRun = async () => {
    setRunning(true);
    const result = await runWeeklyInspection(weekStart);
    setInspection(result);
    await Promise.all([refreshGoal(), refreshTasks()]);
    refreshStats();
    setRunning(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Weekly inspection</Text>
          <Text style={styles.title}>Active goal accountability</Text>
          <Text style={styles.range}>{formatShortDate(weekStart)} - {formatShortDate(weekEnd)}</Text>
        </View>

        {!activeGoal ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No active goal</Text>
            <Text style={styles.muted}>Create the active goal before running an inspection.</Text>
          </View>
        ) : (
          <>
            <View style={styles.resultPanel}>
              <Text style={styles.goalTitle}>{activeGoal.title}</Text>
              <Text style={[styles.resultText, { color: resultColor(inspection?.result) }]}>
                {inspection ? inspection.result.toUpperCase() : 'READY'}
              </Text>
              <Text style={styles.muted}>
                Phase {activeGoal.difficultyPhase} inspection. Pass, partial, or fail applies once per week.
              </Text>
            </View>

            <View style={styles.grid}>
              <Metric label="XP earned" value={`${xpEarned}`} />
              <Metric label="Tasks completed" value={`${tasksCompleted}`} />
              <Metric label="Hard tasks T3+" value={`${hardTasksCompleted}`} />
              <Metric label="Valid days" value={`${validDays}/5`} />
              <Metric label="Build health change" value={`${buildHealthChange > 0 ? '+' : ''}${buildHealthChange}`} />
              <Metric label="Build health" value={`${activeGoal.buildHealth}/100`} />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleRun} disabled={running} activeOpacity={0.85}>
              <Text style={styles.buttonText}>{running ? 'Running...' : 'Run weekly inspection'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 18, paddingBottom: 44 },
  header: { gap: 6 },
  eyebrow: { color: C.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: C.text, fontSize: 28, fontWeight: '800' },
  range: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  empty: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 18, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  muted: { color: C.textSecondary, fontSize: 13, lineHeight: 18 },
  resultPanel: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 18, gap: 8 },
  goalTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  resultText: { fontSize: 24, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 4 },
  metricValue: { color: C.text, fontSize: 22, fontWeight: '900' },
  metricLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  button: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
