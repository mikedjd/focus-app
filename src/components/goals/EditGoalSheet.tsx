import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Goal, GoalWriteInput } from '../../types';
import { BottomSheetModal } from '../BottomSheetModal';
import { GoalBasicsFields } from './GoalFormFields';
import { goalSheetStyles as styles } from './styles';

interface Props {
  visible: boolean;
  goal: Goal | null;
  onClose: () => void;
  onSubmit: (goalId: string, input: GoalWriteInput) => void;
}

export function EditGoalSheet({ visible, goal, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [targetOutcome, setTargetOutcome] = useState('');
  const [metric, setMetric] = useState('');
  const [hasTargetDate, setHasTargetDate] = useState(false);
  const [targetDate, setTargetDate] = useState('');

  useEffect(() => {
    if (visible && goal) {
      setTitle(goal.title);
      setTargetOutcome(goal.targetOutcome);
      setMetric(goal.metric);
      setHasTargetDate(!!goal.targetDate);
      setTargetDate(goal.targetDate ?? '');
    }
  }, [goal, visible]);

  const hasValidDate = !hasTargetDate || /^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim());
  const canSubmit = title.trim().length > 0 && targetOutcome.trim().length > 0 && hasValidDate;

  const handleSubmit = () => {
    if (!goal || !canSubmit) {
      return;
    }

    onSubmit(goal.id, {
      ...goal,
      title: title.trim(),
      targetOutcome: targetOutcome.trim(),
      targetDate: hasTargetDate ? targetDate.trim() : null,
      metric: metric.trim(),
    });
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={styles.modalTitle}>Edit goal</Text>
      <GoalBasicsFields
        title={title}
        targetOutcome={targetOutcome}
        metric={metric}
        hasTargetDate={hasTargetDate}
        targetDate={targetDate}
        autoFocus
        onChangeTitle={setTitle}
        onChangeTargetOutcome={setTargetOutcome}
        onChangeMetric={setMetric}
        onChangeHasTargetDate={setHasTargetDate}
        onChangeTargetDate={setTargetDate}
      />

      {hasTargetDate && !hasValidDate ? (
        <Text style={styles.helperText}>Use `YYYY-MM-DD` for the target date.</Text>
      ) : null}

      <View style={styles.modalActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, !canSubmit && styles.confirmDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.confirmText}>Save</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}
