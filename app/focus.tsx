import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  abandonFocusSession,
  completeFocusSession,
  completeTask,
  getActiveGoal,
  getFocusSessionById,
  getTaskById,
  removeContext,
  sendRpcBeacon,
  startFocusSession,
  touchFocusSession,
} from '../src/api/client';
import { BottomSheetModal } from '../src/components/BottomSheetModal';
import { C } from '../src/constants/colors';
import type { FocusExitReason, FocusSession, DailyTask, Goal } from '../src/types';
import { formatElapsed } from '../src/utils/dates';
import { DAILY_PHASES } from '../src/utils/dailyPhases';
import { dbRecomputeGoalFriction } from '../src/db';
import { useDailyRhythmSettings } from '../src/hooks/useDailyRhythmSettings';

const BG = '#12121A';
const TEXT_DIM = 'rgba(255,255,255,0.45)';
const TEXT_MID = 'rgba(255,255,255,0.7)';
const HEARTBEAT_INTERVAL_MS = 15000;
type TimerStage = 'focus' | 'break';

const EXIT_REASONS: Array<{ id: Exclude<FocusExitReason, 'switched_task'>; label: string }> = [
  { id: 'distraction', label: 'Distraction' },
  { id: 'task_unclear', label: 'Task unclear' },
  { id: 'too_tired', label: 'Too tired' },
  { id: 'interrupted', label: 'Interrupted' },
  { id: 'avoided_it', label: 'Avoided it' },
];

export default function FocusScreen() {
  const { taskId, sessionId } = useLocalSearchParams<{ taskId: string; sessionId?: string }>();
  const router = useRouter();

  const [task, setTask] = useState<DailyTask | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [session, setSession] = useState<FocusSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timerStage, setTimerStage] = useState<TimerStage>('focus');
  const [stageStartedAt, setStageStartedAt] = useState(Date.now());
  const [stageRemaining, setStageRemaining] = useState(0);
  const [cycleCount, setCycleCount] = useState(1);
  const [done, setDone] = useState(false);
  const [showExitSheet, setShowExitSheet] = useState(false);
  const [selectedExitReason, setSelectedExitReason] = useState<
    Exclude<FocusExitReason, 'switched_task'> | null
  >(null);
  const [allowLeave, setAllowLeave] = useState(false);
  const [focusAssistState, setFocusAssistState] = useState<'idle' | 'opened' | 'unavailable'>('idle');
  const { focusModeAssistEnabled } = useDailyRhythmSettings();

  const focusDurationSeconds = useMemo(
    () => Math.max(60, (task?.focusDurationMinutes ?? 50) * 60),
    [task?.focusDurationMinutes]
  );
  const breakDurationSeconds = useMemo(
    () => Math.max(0, (task?.breakDurationMinutes ?? 10) * 60),
    [task?.breakDurationMinutes]
  );
  const phase = useMemo(
    () => DAILY_PHASES.find((candidate) => candidate.id === task?.phaseId) ?? DAILY_PHASES[0],
    [task?.phaseId]
  );

  const refreshFocusState = useCallback(() => {
    if (!taskId) return;

    void (async () => {
      const [nextTask, nextGoal] = await Promise.all([getTaskById(taskId), getActiveGoal()]);
      setTask(nextTask);
      setGoal(nextGoal);
      setDone(nextTask?.status === 'done');

      if (!nextTask || nextTask.status === 'done') {
        setSession(null);
        return;
      }

      const requestedSession = sessionId ? await getFocusSessionById(sessionId) : null;
      await removeContext('dismissed_resume_task_id');
      const activeSession =
        requestedSession && requestedSession.status === 'active' && requestedSession.taskId === taskId
          ? requestedSession
          : await startFocusSession(taskId);

      setSession(activeSession);
      if (activeSession) {
        setElapsed(Math.max(0, Math.floor((Date.now() - activeSession.startedAt) / 1000)));
        setTimerStage('focus');
        setStageStartedAt(Date.now());
        setStageRemaining(Math.max(60, (nextTask?.focusDurationMinutes ?? 50) * 60));
        setCycleCount(1);
      }
    })();
  }, [sessionId, taskId]);

  useEffect(() => {
    refreshFocusState();
  }, [refreshFocusState]);

  useEffect(() => {
    if (!session || session.status !== 'active' || done) {
      return;
    }

    setElapsed(Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));

    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [done, session]);

  const startStage = useCallback(
    (nextStage: TimerStage) => {
      const now = Date.now();
      setTimerStage(nextStage);
      setStageStartedAt(now);
      setStageRemaining(nextStage === 'focus' ? focusDurationSeconds : breakDurationSeconds);
      if (nextStage === 'focus') {
        setCycleCount((current) => current + 1);
      }
    },
    [breakDurationSeconds, focusDurationSeconds]
  );

  useEffect(() => {
    if (!session || session.status !== 'active' || done) {
      return;
    }

    const tick = () => {
      const targetSeconds = timerStage === 'focus' ? focusDurationSeconds : breakDurationSeconds;
      if (targetSeconds <= 0) {
        if (timerStage === 'break') {
          startStage('focus');
        } else {
          setStageRemaining(0);
        }
        return;
      }

      const elapsedInStage = Math.max(0, Math.floor((Date.now() - stageStartedAt) / 1000));
      const remaining = Math.max(0, targetSeconds - elapsedInStage);
      setStageRemaining(remaining);

      if (remaining > 0) {
        return;
      }

      if (timerStage === 'focus' && breakDurationSeconds > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        startStage('break');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startStage('focus');
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [breakDurationSeconds, done, focusDurationSeconds, session, stageStartedAt, startStage, timerStage]);

  useEffect(() => {
    if (!session || session.status !== 'active' || done) {
      return;
    }

    const interval = setInterval(() => {
      void touchFocusSession(session.id);
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [done, session]);

  const helperText = useMemo(() => {
    if (!task) {
      return '';
    }

    if (timerStage === 'break') {
      return 'Step away on purpose. Let the break finish, then roll back into the next focus block.';
    }

    if (task.nextStep) {
      return task.nextStep;
    }

    return task.sourceTaskId
      ? 'Return to the next concrete move on this task. Stay here until you can finish or exit intentionally.'
      : 'Stay on this one task until you can finish it or choose to exit intentionally.';
  }, [task, timerStage]);

  const openPhoneFocusAssist = useCallback(async () => {
    if (Platform.OS === 'web') {
      setFocusAssistState('unavailable');
      return false;
    }

    try {
      if (Platform.OS === 'android' && typeof (Linking as typeof Linking & { sendIntent?: Function }).sendIntent === 'function') {
        await (Linking as typeof Linking & { sendIntent: (action: string) => Promise<void> }).sendIntent('android.settings.ZEN_MODE_SETTINGS');
        setFocusAssistState('opened');
        return true;
      }

      if (Platform.OS === 'ios') {
        for (const url of ['App-Prefs:FOCUS', 'App-Prefs:ROOT=DO_NOT_DISTURB']) {
          const supported = await Linking.canOpenURL(url);
          if (supported) {
            await Linking.openURL(url);
            setFocusAssistState('opened');
            return true;
          }
        }
      }

      await Linking.openSettings();
      setFocusAssistState('opened');
      return true;
    } catch {
      setFocusAssistState('unavailable');
      return false;
    }
  }, []);

  useEffect(() => {
    if (!focusModeAssistEnabled || !session || session.status !== 'active' || done) {
      return;
    }

    void openPhoneFocusAssist();
  }, [done, focusModeAssistEnabled, openPhoneFocusAssist, session]);

  const handleDone = useCallback(() => {
    if (!taskId || !session) {
      return;
    }

    void (async () => {
      setAllowLeave(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const completedSession = await completeFocusSession(session.id);
      await completeTask(taskId);
      if (goal?.id) {
        try {
          dbRecomputeGoalFriction(goal.id);
        } catch {
          /* native-only; ignore on web */
        }
      }
      setSession(completedSession);
      setElapsed(completedSession?.durationSeconds ?? elapsed);
      setDone(true);
      setTimeout(() => router.replace('/(tabs)'), 900);
    })();
  }, [elapsed, goal?.id, router, session, taskId]);

  const handleRequestExit = useCallback(() => {
    setSelectedExitReason(null);
    setShowExitSheet(true);
  }, []);

  const handleExitEarly = useCallback(() => {
    if (!session || !selectedExitReason) {
      return;
    }

    void (async () => {
      setAllowLeave(true);
      await abandonFocusSession(session.id, selectedExitReason);
      setShowExitSheet(false);
      router.replace('/(tabs)');
    })();
  }, [router, selectedExitReason, session]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !session || session.status !== 'active' || done) {
      return;
    }

    const handleBeforeUnload = () => {
      sendRpcBeacon('touchFocusSession', { id: session.id });
    };

    const handlePopState = () => {
      if (allowLeave) {
        return;
      }

      window.history.pushState({ focusGuard: true }, '', window.location.href);
      setSelectedExitReason(null);
      setShowExitSheet(true);
    };

    window.history.pushState({ focusGuard: true }, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [allowLeave, done, session]);

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
      <View style={styles.topBar}>
        {!done ? (
          <TouchableOpacity style={styles.closeBtn} onPress={handleRequestExit}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.closeSpacer} />
        )}
        <View style={styles.topBarSpacer} />
        <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
      </View>

      <View style={styles.content}>
        {done ? (
          <View style={styles.doneContainer}>
            <View style={styles.doneCircle}>
              <Text style={styles.doneCheckmark}>✓</Text>
            </View>
            <Text style={styles.doneTitle}>Done.</Text>
            <Text style={styles.doneElapsed}>{formatElapsed(elapsed)}</Text>
            {goal ? <Text style={styles.doneGoal}>One step closer to: {goal.title}</Text> : null}
          </View>
        ) : (
          <>
            <Text style={styles.focusLabel}>{timerStage === 'focus' ? 'Focus block' : 'Break block'}</Text>
            <Text style={styles.countdown}>{formatElapsed(stageRemaining)}</Text>
            <Text style={styles.countdownMeta}>
              {timerStage === 'focus' ? `${task.focusDurationMinutes} min focus` : `${task.breakDurationMinutes} min break`} · cycle {cycleCount}
            </Text>
            <View style={styles.metaChips}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{phase.title}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {task.focusDurationMinutes}/{task.breakDurationMinutes} min
                </Text>
              </View>
            </View>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.helperText}>{helperText}</Text>
            <Text style={styles.phaseHint}>{phase.summary}</Text>
            {goal ? (
              <Text style={styles.frictionHint}>
                Aim for {goal.currentFrictionMinutes} min. Stay past it and watch your floor rise.
              </Text>
            ) : null}

            {goal ? (
              <View style={styles.goalLink}>
                <Text style={styles.goalLinkArrow}>↑</Text>
                <Text style={styles.goalLinkText} numberOfLines={1}>
                  {goal.title}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.assistButton} onPress={() => void openPhoneFocusAssist()} activeOpacity={0.8}>
              <Text style={styles.assistButtonText}>Phone focus</Text>
            </TouchableOpacity>
            <Text style={styles.assistHint}>
              {focusAssistState === 'opened'
                ? 'System focus settings opened.'
                : focusAssistState === 'unavailable'
                  ? 'This device does not expose focus settings to the app.'
                  : 'Use this to flip your phone into Focus or Do Not Disturb before the block.'}
            </Text>

            {timerStage === 'break' ? (
              <TouchableOpacity style={styles.skipBreakButton} onPress={() => startStage('focus')} activeOpacity={0.8}>
                <Text style={styles.skipBreakText}>Skip break</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>

      {!done ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone} activeOpacity={0.85}>
            <Text style={styles.doneButtonText}>Complete task</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleRequestExit}>
            <Text style={styles.backButtonText}>Exit early</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <BottomSheetModal visible={showExitSheet} onClose={() => setShowExitSheet(false)}>
        <Text style={styles.sheetTitle}>Exit early?</Text>
        <Text style={styles.sheetSubtitle}>
          Pick the reason that fits best so the app can help you resume clearly later.
        </Text>

        {goal?.anchorWhy ? (
          <View style={styles.anchorBlock}>
            <Text style={styles.anchorLabel}>Why this matters</Text>
            <Text style={styles.anchorText}>{goal.anchorWhy}</Text>
          </View>
        ) : null}

        {goal?.anchorDrift ? (
          <View style={styles.anchorBlock}>
            <Text style={styles.anchorLabel}>Cost of drift</Text>
            <Text style={styles.anchorText}>{goal.anchorDrift}</Text>
          </View>
        ) : null}

        <View style={styles.reasonGrid}>
          {EXIT_REASONS.map((reason) => {
            const selected = selectedExitReason === reason.id;
            return (
              <TouchableOpacity
                key={reason.id}
                style={[styles.reasonChip, selected && styles.reasonChipActive]}
                onPress={() => setSelectedExitReason(reason.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.reasonChipText, selected && styles.reasonChipTextActive]}>
                  {reason.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={styles.sheetSecondaryButton}
            onPress={() => setShowExitSheet(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.sheetSecondaryText}>Keep going</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sheetPrimaryButton,
              !selectedExitReason && styles.sheetPrimaryButtonDisabled,
            ]}
            onPress={handleExitEarly}
            disabled={!selectedExitReason}
            activeOpacity={0.85}
          >
            <Text style={styles.sheetPrimaryText}>Exit focus</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
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
  closeSpacer: {
    width: 36,
    height: 36,
  },
  closeBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
  topBarSpacer: {
    flex: 1,
  },
  timer: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  focusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 2,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  countdown: {
    fontSize: 54,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
  },
  countdownMeta: {
    marginTop: 8,
    marginBottom: 14,
    fontSize: 13,
    color: TEXT_DIM,
    letterSpacing: 0.3,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  metaChipText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  helperText: {
    fontSize: 15,
    color: TEXT_MID,
    lineHeight: 24,
    marginBottom: 22,
  },
  phaseHint: {
    fontSize: 13,
    color: TEXT_DIM,
    lineHeight: 20,
    marginBottom: 12,
  },
  frictionHint: {
    fontSize: 13,
    color: TEXT_DIM,
    lineHeight: 18,
    marginBottom: 18,
  },
  goalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalLinkArrow: {
    fontSize: 16,
    color: TEXT_DIM,
  },
  goalLinkText: {
    fontSize: 14,
    color: TEXT_DIM,
    flex: 1,
    lineHeight: 20,
  },
  assistButton: {
    marginTop: 18,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(59,91,219,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59,91,219,0.45)',
  },
  assistButtonText: {
    color: '#C9D6FF',
    fontSize: 13,
    fontWeight: '700',
  },
  assistHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_DIM,
  },
  skipBreakButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  skipBreakText: {
    color: '#C9D6FF',
    fontSize: 14,
    fontWeight: '600',
  },
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
  doneButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  backButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    color: TEXT_DIM,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: TEXT_DIM,
    fontSize: 16,
  },
  doneContainer: {
    alignItems: 'center',
    paddingTop: 48,
  },
  doneCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  doneCheckmark: {
    fontSize: 36,
    color: '#fff',
  },
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
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  anchorBlock: {
    borderRadius: 12,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
  },
  anchorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  anchorText: {
    fontSize: 14,
    lineHeight: 20,
    color: C.text,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  reasonChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  reasonChipActive: {
    backgroundColor: C.accentLight,
    borderColor: C.accent,
  },
  reasonChipText: {
    fontSize: 14,
    color: C.textSecondary,
    fontWeight: '600',
  },
  reasonChipTextActive: {
    color: C.accent,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetSecondaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: C.surfaceSecondary,
  },
  sheetSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textSecondary,
  },
  sheetPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: C.accent,
  },
  sheetPrimaryButtonDisabled: {
    opacity: 0.4,
  },
  sheetPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
