import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { Goal, GoalWriteInput } from '../../types';
import { BottomSheetModal } from '../BottomSheetModal';
import { generateAnchorLines } from '../../utils/goalAnchors';
import { GoalAnchorFields, GoalReasonFields } from './GoalFormFields';
import { goalSheetStyles as styles } from './styles';

interface Props {
  visible: boolean;
  goal: Goal | null;
  onClose: () => void;
  onSubmit: (goalId: string, input: GoalWriteInput) => void;
}

export function EditWhySheet({ visible, goal, onClose, onSubmit }: Props) {
  const [practicalReason, setPracticalReason] = useState('');
  const [emotionalReason, setEmotionalReason] = useState('');
  const [costOfDrift, setCostOfDrift] = useState('');
  const [anchorWhy, setAnchorWhy] = useState('');
  const [anchorDrift, setAnchorDrift] = useState('');
  const lastAutoAnchor = useRef({ anchorWhy: '', anchorDrift: '' });

  useEffect(() => {
    if (visible) {
      setPracticalReason(goal?.practicalReason ?? '');
      setEmotionalReason(goal?.emotionalReason ?? '');
      setCostOfDrift(goal?.costOfDrift ?? '');
      setAnchorWhy(goal?.anchorWhy ?? goal?.why ?? '');
      setAnchorDrift(goal?.anchorDrift ?? '');
      lastAutoAnchor.current = generateAnchorLines({
        practicalReason: goal?.practicalReason ?? '',
        emotionalReason: goal?.emotionalReason ?? '',
        costOfDrift: goal?.costOfDrift ?? '',
      });
    }
  }, [goal, visible]);

  useEffect(() => {
    const nextAutoAnchor = generateAnchorLines({
      practicalReason,
      emotionalReason,
      costOfDrift,
    });

    setAnchorWhy((current) => {
      if (!current.trim() || current.trim() === lastAutoAnchor.current.anchorWhy) {
        return nextAutoAnchor.anchorWhy;
      }
      return current;
    });
    setAnchorDrift((current) => {
      if (!current.trim() || current.trim() === lastAutoAnchor.current.anchorDrift) {
        return nextAutoAnchor.anchorDrift;
      }
      return current;
    });
    lastAutoAnchor.current = nextAutoAnchor;
  }, [practicalReason, emotionalReason, costOfDrift]);

  const canSubmit =
    practicalReason.trim().length > 0 &&
    emotionalReason.trim().length > 0 &&
    costOfDrift.trim().length > 0 &&
    anchorWhy.trim().length > 0 &&
    anchorDrift.trim().length > 0;

  const handleSubmit = () => {
    if (!goal || !canSubmit) {
      return;
    }

    onSubmit(goal.id, {
      ...goal,
      practicalReason: practicalReason.trim(),
      emotionalReason: emotionalReason.trim(),
      costOfDrift: costOfDrift.trim(),
      anchorWhy: anchorWhy.trim(),
      anchorDrift: anchorDrift.trim(),
      why: anchorWhy.trim(),
    });
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={styles.modalTitle}>Why does this matter?</Text>
      <Text style={styles.modalSubtitle}>Keep it direct. This is the anchor the app will use.</Text>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <GoalReasonFields
          practicalReason={practicalReason}
          emotionalReason={emotionalReason}
          costOfDrift={costOfDrift}
          onChangePracticalReason={setPracticalReason}
          onChangeEmotionalReason={setEmotionalReason}
          onChangeCostOfDrift={setCostOfDrift}
        />

        <Text style={styles.helperText}>
          These short lines are pulled into Today and Focus. Edit them until they feel real.
        </Text>

        <GoalAnchorFields
          anchorWhy={anchorWhy}
          anchorDrift={anchorDrift}
          onChangeAnchorWhy={setAnchorWhy}
          onChangeAnchorDrift={setAnchorDrift}
        />
      </ScrollView>

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
