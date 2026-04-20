import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Project, TaskWriteResult } from '../../types';
import { C } from '../../constants/colors';
import { BottomSheetModal } from '../BottomSheetModal';

interface Props {
  visible: boolean;
  activeGoalTitle?: string;
  projects: Project[];
  selectedProjectId?: string | null;
  initialTitle?: string;
  onClose: () => void;
  onSubmit: (title: string, nextStep?: string, projectId?: string | null) => Promise<TaskWriteResult>;
}

export function AddTaskSheet({ visible, activeGoalTitle, projects, selectedProjectId, initialTitle, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [projectId, setProjectId] = useState<string | null>(selectedProjectId ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setNextStep('');
      setProjectId(selectedProjectId ?? null);
      setErrorMessage(null);
    } else if (initialTitle) {
      setTitle(initialTitle);
    }
  }, [visible, selectedProjectId, initialTitle]);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const result = await onSubmit(title.trim(), nextStep.trim(), projectId);
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
