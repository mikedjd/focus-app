import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { GoalWriteInput } from '../../types';
import { BottomSheetModal } from '../BottomSheetModal';
import { C } from '../../constants/colors';
import { GoalBasicsFields } from './GoalFormFields';
import { goalSheetStyles as styles } from './styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: GoalWriteInput) => void;
}

export function CreateGoalSheet({ visible, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [targetOutcome, setTargetOutcome] = useState('');
  const [metric, setMetric] = useState('');
  const [hasTargetDate, setHasTargetDate] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [anchorWhy, setAnchorWhy] = useState('');

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setTargetOutcome('');
      setMetric('');
      setHasTargetDate(false);
      setTargetDate('');
      setAnchorWhy('');
    }
  }, [visible]);

  const hasValidDate = !hasTargetDate || /^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim());
  const canSubmit =
    title.trim().length > 0 &&
    targetOutcome.trim().length > 0 &&
    anchorWhy.trim().length > 0 &&
    hasValidDate;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    onSubmit({
      title: title.trim(),
      targetOutcome: targetOutcome.trim(),
      targetDate: hasTargetDate ? targetDate.trim() : null,
      metric: metric.trim(),
      anchorWhy: anchorWhy.trim(),
    });
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={styles.modalTitle}>Set your goal</Text>
      <Text style={styles.modalSubtitle}>Keep it concrete. You can refine the deeper why next.</Text>

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

      <Text style={styles.fieldLabel}>Why this matters</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={anchorWhy}
        onChangeText={setAnchorWhy}
        placeholder="What should this goal remind you of?"
        placeholderTextColor={C.textMuted}
        multiline
        numberOfLines={3}
        maxLength={180}
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
          <Text style={styles.confirmText}>Set Goal</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}
