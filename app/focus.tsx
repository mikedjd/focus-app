import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { dbGetTaskById, dbGetActiveGoal, dbCompleteTask } from '../src/db';
import type { DailyTask, Goal } from '../src/types';
import { C } from '../src/constants/colors';
import { formatElapsed } from '../src/utils/dates';

const BG = '#12121A';
const TEXT_DIM = 'rgba(255,255,255,0.45)';
const TEXT_MID = 'rgba(255,255,255,0.65)';

export default function FocusScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();

  const [task, setTask] = useState<DailyTask | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (taskId) {
      const t = dbGetTaskById(taskId);
      setTask(t);
      setDone(t?.status === 'done');
      setGoal(dbGetActiveGoal());
    }
  }, [taskId]);

  useEffect(() => {
    if (done) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [done]);

  const handleDone = useCallback(() => {
    if (!taskId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dbCompleteTask(taskId);
    setDone(true);
    setTimeout(() => router.back(), 900);
  }, [taskId, router]);

  if (!task) {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.errorText}>Task not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Top bar ─────────────────────────────────── */}
      <View style={styles.topBar}>
        {!done && (
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
        <View style={styles.topBarSpacer} />
        {!done && (
          <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
        )}
      </View>

      {/* ── Main content ────────────────────────────── */}
      <View style={styles.content}>
        {done ? (
          /* Done state */
          <View style={styles.doneContainer}>
            <View style={styles.doneCircle}>
              <Text style={styles.doneCheckmark}>✓</Text>
            </View>
            <Text style={styles.doneTitle}>Done.</Text>
            <Text style={styles.doneElapsed}>{formatElapsed(elapsed)}</Text>
            {goal ? (
              <Text style={styles.doneGoal}>
                One step closer to: {goal.title}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            {/* Why anchor — shown first, above the task, so it sets context */}
            {goal?.why ? (
              <View style={styles.whyAnchor}>
                <Text style={styles.whyAnchorLabel}>WHY THIS MATTERS</Text>
                <Text style={styles.whyAnchorText}>"{goal.why}"</Text>
              </View>
            ) : null}

            {/* Task */}
            <Text style={styles.focusLabel}>NOW</Text>
            <Text style={styles.taskTitle}>{task.title}</Text>

            {/* Goal link */}
            {goal ? (
              <View style={styles.goalLink}>
                <Text style={styles.goalLinkArrow}>↑</Text>
                <Text style={styles.goalLinkText} numberOfLines={1}>
                  {goal.title}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* ── Bottom action ───────────────────────────── */}
      {!done && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            activeOpacity={0.85}
          >
            <Text style={styles.doneButtonText}>Mark Done</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to Today</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  topBarSpacer: { flex: 1 },
  timer: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    justifyContent: 'flex-start',
  },

  // Why anchor — appears at top to frame the task
  whyAnchor: {
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    paddingLeft: 14,
    marginBottom: 36,
  },
  whyAnchorLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  whyAnchorText: {
    fontSize: 15,
    color: TEXT_MID,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Task block
  focusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 2,
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 24,
  },

  // Goal link
  goalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalLinkArrow: { fontSize: 16, color: TEXT_DIM },
  goalLinkText: {
    fontSize: 14,
    color: TEXT_DIM,
    flex: 1,
    lineHeight: 20,
  },

  // Done state
  doneContainer: { alignItems: 'center', paddingTop: 48 },
  doneCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  doneCheckmark: { fontSize: 36, color: '#fff' },
  doneTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  doneElapsed: {
    fontSize: 14,
    color: TEXT_DIM,
    marginBottom: 20,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  doneGoal: {
    fontSize: 14,
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
  },

  // Bottom
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 10,
  },
  doneButton: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  doneButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  backButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: { fontSize: 15, color: TEXT_DIM },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: TEXT_DIM, fontSize: 16 },
});
