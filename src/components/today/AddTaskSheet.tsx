import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { DailyPhaseId, Project, TaskPlanInput, TaskWriteResult } from '../../types';
import { C } from '../../constants/colors';
import { BottomSheetModal } from '../BottomSheetModal';
import { useDailyRhythmSettings } from '../../hooks/useDailyRhythmSettings';
import { DAILY_PHASES, clampBreakMinutes, clampDurationMinutes } from '../../utils/dailyPhases';

interface Props {
  visible: boolean;
  activeGoalTitle?: string;
  projects: Project[];
  selectedProjectId?: string | null;
  initialPhaseId?: DailyPhaseId;
  initialTitle?: string;
  onClose: () => void;
  onSubmit: (input: TaskPlanInput) => Promise<TaskWriteResult>;
}

export function AddTaskSheet({
  visible,
  activeGoalTitle,
  projects,
  selectedProjectId,
  initialPhaseId = 'phase1',
  initialTitle,
  onClose,
  onSubmit,
}: Props) {
  const {
    defaultFocusMinutes,
    defaultBreakMinutes,
  } = useDailyRhythmSettings();
  const [title, setTitle] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [projectId, setProjectId] = useState<string | null>(selectedProjectId ?? null);
  const [phaseId, setPhaseId] = useState<DailyPhaseId>(initialPhaseId);
  const [focusMinutes, setFocusMinutes] = useState(String(defaultFocusMinutes));
  const [breakMinutes, setBreakMinutes] = useState(String(defaultBreakMinutes));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setNextStep('');
      setProjectId(selectedProjectId ?? null);
      setPhaseId(initialPhaseId);
      setFocusMinutes(String(defaultFocusMinutes));
      setBreakMinutes(String(defaultBreakMinutes));
      setErrorMessage(null);
    } else if (initialTitle) {
      setTitle(initialTitle);
    }
  }, [visible, selectedProjectId, initialTitle, initialPhaseId, defaultFocusMinutes, defaultBreakMinutes]);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const result = await onSubmit({
      title: title.trim(),
      nextStep: nextStep.trim(),
      projectId,
      phaseId,
      focusDurationMinutes: clampDurationMinutes(Number(focusMinutes), defaultFocusMinutes),
      breakDurationMinutes: clampBreakMinutes(Number(breakMinutes), defaultBreakMinutes),
    });
    if (result.ok) {
      setTitle('');
      setErrorMessage(null);
      onClose();
      return;
    }
    if (result.reason === 'task_limit_reached') {
      setErrorMessage("Today's 3-task limit is already full.");
      return;
    }
    setErrorMessage('Task could not be saved right now.');
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>What needs doing?</Text>
      <Text style={styles.goalHint}>
        {activeGoalTitle ? `Main goal: ${activeGoalTitle}` : 'Adds to Secondary Tasks'}
      </Text>

      <TextInput
        style={styles.input}
        value={title}
        onChangeText={(v) => { setTitle(v); if (errorMessage) setErrorMessage(null); }}
        placeholder="One concrete action..."
        placeholderTextColor={C.textMuted}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void handleSubmit()}
        multiline={false}
        maxLength={120}
      />
      <TextInput
        style={[styles.input, styles.secondaryInput]}
        value={nextStep}
        onChangeText={setNextStep}
        placeholder="Optional: next step for focus mode"
        placeholderTextColor={C.textMuted}
        returnKeyType="done"
        onSubmitEditing={() => void handleSubmit()}
        multiline={false}
        maxLength={140}
      />

      {projects.length > 0 ? (
        <View style={styles.projectSection}>
          <Text style={styles.projectLabel}>Project</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectScroll}>
            <TouchableOpacity
              style={[styles.projectChip, projectId === null && styles.projectChipActive]}
              onPress={() => setProjectId(null)}
            >
              <Text style={[styles.projectChipText, projectId === null && styles.projectChipTextActive]}>
                None
              </Text>
            </TouchableOpacity>
            {projects.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.projectChip,
                  { borderColor: p.color },
                  projectId === p.id && { backgroundColor: p.color },
                ]}
                onPress={() => setProjectId(p.id)}
              >
                <View style={[styles.chipDot, { backgroundColor: p.color, opacity: projectId === p.id ? 0 : 1 }]} />
                <Text style={[styles.projectChipText, projectId === p.id && styles.projectChipTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.projectSection}>
        <Text style={styles.projectLabel}>Day phase</Text>
        <View style={styles.phaseGrid}>
          {DAILY_PHASES.map((phase) => {
            const selected = phaseId === phase.id;
            return (
              <TouchableOpacity
                key={phase.id}
                style={[styles.phaseCard, selected && styles.phaseCardActive]}
                onPress={() => setPhaseId(phase.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.phaseTitle, selected && styles.phaseTitleActive]}>
                  {phase.title}
                </Text>
                <Text style={[styles.phaseSubtitle, selected && styles.phaseSubtitleActive]}>
                  {phase.shortLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.timerRow}>
        <View style={styles.timerField}>
          <Text style={styles.projectLabel}>Focus (min)</Text>
          <TextInput
            style={styles.timerInput}
            value={focusMinutes}
            onChangeText={setFocusMinutes}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
        <View style={styles.timerField}>
          <Text style={styles.projectLabel}>Break (min)</Text>
          <TextInput
            style={styles.timerInput}
            value={breakMinutes}
            onChangeText={setBreakMinutes}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>
      <Text style={styles.timerHint}>
        This preset feeds the focus screen for this daily goal.
      </Text>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, !canSubmit && styles.confirmButtonDisabled]}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
        >
          <Text style={styles.confirmButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 6 },
  goalHint: { fontSize: 14, color: C.textSecondary, marginBottom: 18 },
  input: {
    fontSize: 16,
    color: C.text,
    borderBottomWidth: 1.5,
    borderBottomColor: C.accent,
    paddingVertical: 10,
    marginBottom: 16,
  },
  secondaryInput: { fontSize: 14 },
  projectSection: { marginBottom: 16 },
  projectLabel: { fontSize: 12, color: C.textSecondary, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  projectScroll: { flexGrow: 0 },
  phaseGrid: {
    gap: 8,
  },
  phaseCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  phaseCardActive: {
    backgroundColor: C.accentLight,
    borderColor: C.accent,
  },
  phaseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  phaseTitleActive: {
    color: C.accent,
  },
  phaseSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: C.textSecondary,
  },
  phaseSubtitleActive: {
    color: C.accent,
  },
  projectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    marginRight: 8,
    backgroundColor: C.surface,
  },
  projectChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  projectChipText: { fontSize: 13, color: C.text, fontWeight: '500' },
  projectChipTextActive: { color: '#fff', fontWeight: '600' },
  timerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timerField: {
    flex: 1,
  },
  timerInput: {
    fontSize: 16,
    color: C.text,
    borderBottomWidth: 1.5,
    borderBottomColor: C.border,
    paddingVertical: 10,
  },
  timerHint: {
    marginTop: 10,
    marginBottom: 2,
    fontSize: 12,
    lineHeight: 17,
    color: C.textSecondary,
  },
  errorText: { fontSize: 13, color: C.danger, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.surfaceSecondary, alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, color: C.textSecondary, fontWeight: '500' },
  confirmButton: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.accent, alignItems: 'center',
  },
  confirmButtonDisabled: { opacity: 0.4 },
  confirmButtonText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
