import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { C } from '../../constants/colors';
import { goalSheetStyles as styles } from './styles';

interface GoalBasicsProps {
  title: string;
  targetOutcome: string;
  metric: string;
  hasTargetDate: boolean;
  targetDate: string;
  autoFocus?: boolean;
  onChangeTitle: (value: string) => void;
  onChangeTargetOutcome: (value: string) => void;
  onChangeMetric: (value: string) => void;
  onChangeHasTargetDate: (value: boolean) => void;
  onChangeTargetDate: (value: string) => void;
}

interface GoalReasonsProps {
  practicalReason: string;
  emotionalReason: string;
  costOfDrift: string;
  onChangePracticalReason: (value: string) => void;
  onChangeEmotionalReason: (value: string) => void;
  onChangeCostOfDrift: (value: string) => void;
}

interface GoalAnchorsProps {
  anchorWhy: string;
  anchorDrift: string;
  onChangeAnchorWhy: (value: string) => void;
  onChangeAnchorDrift: (value: string) => void;
}

export function GoalBasicsFields({
  title,
  targetOutcome,
  metric,
  hasTargetDate,
  targetDate,
  autoFocus,
  onChangeTitle,
  onChangeTargetOutcome,
  onChangeMetric,
  onChangeHasTargetDate,
  onChangeTargetDate,
}: GoalBasicsProps) {
  return (
    <>
      <Text style={styles.fieldLabel}>Goal title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={onChangeTitle}
        placeholder="What is the one goal?"
        placeholderTextColor={C.textMuted}
        autoFocus={autoFocus}
        maxLength={120}
      />

      <Text style={styles.fieldLabel}>Target outcome</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={targetOutcome}
        onChangeText={onChangeTargetOutcome}
        placeholder="What would count as done?"
        placeholderTextColor={C.textMuted}
        multiline
        numberOfLines={3}
        maxLength={200}
      />

      <Text style={styles.fieldLabel}>Target date</Text>
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentButton, hasTargetDate && styles.segmentButtonActive]}
          onPress={() => onChangeHasTargetDate(true)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.segmentText,
              hasTargetDate && styles.segmentTextActive,
            ]}
          >
            Set date
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, !hasTargetDate && styles.segmentButtonActive]}
          onPress={() => onChangeHasTargetDate(false)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.segmentText,
              !hasTargetDate && styles.segmentTextActive,
            ]}
          >
            No fixed date
          </Text>
        </TouchableOpacity>
      </View>

      {hasTargetDate ? (
        <TextInput
          style={styles.input}
          value={targetDate}
          onChangeText={onChangeTargetDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.textMuted}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      ) : null}

      <Text style={styles.fieldLabel}>Metric (optional)</Text>
      <TextInput
        style={styles.input}
        value={metric}
        onChangeText={onChangeMetric}
        placeholder="e.g. 10 users, $2k MRR, 3 workouts/week"
        placeholderTextColor={C.textMuted}
        maxLength={120}
      />
    </>
  );
}

export function GoalReasonFields({
  practicalReason,
  emotionalReason,
  costOfDrift,
  onChangePracticalReason,
  onChangeEmotionalReason,
  onChangeCostOfDrift,
}: GoalReasonsProps) {
  return (
    <>
      <Text style={styles.fieldLabel}>Practical reason</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={practicalReason}
        onChangeText={onChangePracticalReason}
        placeholder="What becomes better or easier if this gets done?"
        placeholderTextColor={C.textMuted}
        multiline
        numberOfLines={3}
        maxLength={180}
      />

      <Text style={styles.fieldLabel}>Emotional reason</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={emotionalReason}
        onChangeText={onChangeEmotionalReason}
        placeholder="Why does this matter to you personally?"
        placeholderTextColor={C.textMuted}
        multiline
        numberOfLines={3}
        maxLength={180}
      />

      <Text style={styles.fieldLabel}>Cost of drift</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={costOfDrift}
        onChangeText={onChangeCostOfDrift}
        placeholder="What happens if this keeps slipping?"
        placeholderTextColor={C.textMuted}
        multiline
        numberOfLines={3}
        maxLength={180}
      />
    </>
  );
}

export function GoalAnchorFields({
  anchorWhy,
  anchorDrift,
  onChangeAnchorWhy,
  onChangeAnchorDrift,
}: GoalAnchorsProps) {
  return (
    <>
      <Text style={styles.fieldLabel}>Why this matters</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={anchorWhy}
        onChangeText={onChangeAnchorWhy}
        placeholder="A short anchor line you can believe."
        placeholderTextColor={C.textMuted}
        multiline
        numberOfLines={3}
        maxLength={180}
      />

      <Text style={styles.fieldLabel}>Cost of drift</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={anchorDrift}
        onChangeText={onChangeAnchorDrift}
        placeholder="A short reminder of what drift costs."
        placeholderTextColor={C.textMuted}
        multiline
        numberOfLines={3}
        maxLength={180}
      />
    </>
  );
}
