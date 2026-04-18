import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { TaskWriteResult } from '../../types';
import { C } from '../../constants/colors';
import { BottomSheetModal } from '../BottomSheetModal';

interface Props {
  visible: boolean;
  activeGoalTitle?: string;
  onClose: () => void;
  onSubmit: (title: string, nextStep?: string) => Promise<TaskWriteResult>;
}

export function AddTaskSheet({ visible, activeGoalTitle, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setNextStep('');
      setErrorMessage(null);
    }
  }, [visible]);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    const result = await onSubmit(title.trim(), nextStep.trim());
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

    if (result.reason === 'missing_goal') {
      setErrorMessage('Set a goal before adding tasks.');
      return;
    }

    setErrorMessage('Task could not be saved right now.');
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>What needs doing today?</Text>
      {activeGoalTitle ? <Text style={styles.goalHint}>Links to: {activeGoalTitle}</Text> : null}
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={(nextValue: string) => {
          setTitle(nextValue);
          if (errorMessage) {
            setErrorMessage(null);
          }
        }}
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
        placeholder="Optional next step to show in focus mode"
        placeholderTextColor={C.textMuted}
        returnKeyType="done"
        onSubmitEditing={() => void handleSubmit()}
        multiline={false}
        maxLength={140}
      />
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  goalHint: {
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 18,
  },
  input: {
    fontSize: 16,
    color: C.text,
    borderBottomWidth: 1.5,
    borderBottomColor: C.accent,
    paddingVertical: 10,
    marginBottom: 16,
  },
  secondaryInput: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 13,
    color: C.accent,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.surfaceSecondary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: C.textSecondary,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});
