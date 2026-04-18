import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheetModal } from '../BottomSheetModal';
import { C } from '../../constants/colors';
import { goalSheetStyles as styles } from './styles';

interface Props {
  visible: boolean;
  goalId?: string;
  currentFocus?: string;
  onClose: () => void;
  onSubmit: (goalId: string, focus: string) => void;
}

export function EditFocusSheet({
  visible,
  goalId,
  currentFocus,
  onClose,
  onSubmit,
}: Props) {
  const [focus, setFocus] = useState('');

  useEffect(() => {
    if (visible) {
      setFocus(currentFocus ?? '');
    }
  }, [currentFocus, visible]);

  const canSubmit = focus.trim().length > 0;

  const handleSubmit = () => {
    if (!goalId || !canSubmit) {
      return;
    }

    onSubmit(goalId, focus.trim());
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={styles.modalTitle}>This week's focus</Text>
      <Text style={styles.modalSubtitle}>
        One sentence. What will you advance on this goal this week?
      </Text>

      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={focus}
        onChangeText={setFocus}
        placeholder="e.g. Ship the landing page and get 5 signups"
        placeholderTextColor={C.textMuted}
        autoFocus
        multiline
        numberOfLines={3}
        maxLength={200}
      />

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
