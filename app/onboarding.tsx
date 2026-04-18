import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  dbClearOnboardingDraft,
  dbCompleteOnboarding,
  dbGetOnboardingDraft,
  dbIsReviewDue,
  dbSaveOnboardingDraft,
} from '../src/db';
import {
  GoalAnchorFields,
  GoalBasicsFields,
  GoalReasonFields,
} from '../src/components/goals/GoalFormFields';
import { goalSheetStyles as formStyles } from '../src/components/goals/styles';
import { C } from '../src/constants/colors';
import { useAppStore } from '../src/store/useAppStore';
import type { OnboardingDraft } from '../src/types';
import { generateAnchorLines } from '../src/utils/goalAnchors';

const TOTAL_STEPS = 6;

const EMPTY_DRAFT: OnboardingDraft = {
  goalTitle: '',
  targetOutcome: '',
  hasTargetDate: false,
  targetDate: '',
  metric: '',
  practicalReason: '',
  emotionalReason: '',
  costOfDrift: '',
  anchorWhy: '',
  anchorDrift: '',
  weeklyFocus: '',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);
  const setReviewDue = useAppStore((state) => state.setReviewDue);
  const setResumeContext = useAppStore((state) => state.setResumeContext);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => dbGetOnboardingDraft() ?? EMPTY_DRAFT);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lastAutoAnchor = useRef(
    generateAnchorLines({
      practicalReason: draft.practicalReason,
      emotionalReason: draft.emotionalReason,
      costOfDrift: draft.costOfDrift,
    })
  );

  useEffect(() => {
    dbSaveOnboardingDraft(draft);
  }, [draft]);

  useEffect(() => {
    const nextAutoAnchor = generateAnchorLines({
      practicalReason: draft.practicalReason,
      emotionalReason: draft.emotionalReason,
      costOfDrift: draft.costOfDrift,
    });

    setDraft((current) => ({
      ...current,
      anchorWhy:
        !current.anchorWhy.trim() || current.anchorWhy.trim() === lastAutoAnchor.current.anchorWhy
          ? nextAutoAnchor.anchorWhy
          : current.anchorWhy,
      anchorDrift:
        !current.anchorDrift.trim() ||
        current.anchorDrift.trim() === lastAutoAnchor.current.anchorDrift
          ? nextAutoAnchor.anchorDrift
          : current.anchorDrift,
    }));

    lastAutoAnchor.current = nextAutoAnchor;
  }, [draft.practicalReason, draft.emotionalReason, draft.costOfDrift]);

  const hasValidTargetDate = useMemo(
    () => !draft.hasTargetDate || /^\d{4}-\d{2}-\d{2}$/.test(draft.targetDate.trim()),
    [draft.hasTargetDate, draft.targetDate]
  );

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return (
          draft.goalTitle.trim().length > 0 &&
          draft.targetOutcome.trim().length > 0 &&
          hasValidTargetDate
        );
      case 2:
        return (
          draft.practicalReason.trim().length > 0 &&
          draft.emotionalReason.trim().length > 0 &&
          draft.costOfDrift.trim().length > 0
        );
      case 3:
        return draft.anchorWhy.trim().length > 0 && draft.anchorDrift.trim().length > 0;
      case 4:
        return draft.weeklyFocus.trim().length > 0;
      case 5:
        return true;
      default:
        return false;
    }
  }, [draft, hasValidTargetDate, step]);

  const handleNext = () => {
    if (!canContinue) {
      return;
    }
    setSubmitError(null);
    if (step < TOTAL_STEPS - 1) {
      setStep((current) => current + 1);
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    setStep((current) => Math.max(0, current - 1));
  };

  const handleFinish = () => {
    setSubmitError(null);
    const result = dbCompleteOnboarding(draft);
    if (!result.goal) {
      setSubmitError('That did not save correctly. Try once more.');
      return;
    }

    dbClearOnboardingDraft();
    setResumeContext(null);
    setReviewDue(dbIsReviewDue());
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const progress = (step + 1) / TOTAL_STEPS;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              {step + 1} / {TOTAL_STEPS}
            </Text>
            <Text style={styles.progressText}>Setup</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 ? (
            <View style={styles.stepBlock}>
              <Text style={styles.eyebrow}>Execution system</Text>
              <Text style={styles.title}>Pick one goal. Anchor it. Execute it.</Text>
              <Text style={styles.copy}>
                This app helps you choose one goal, lock in why it matters, and keep daily action pointed in the same direction.
              </Text>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.stepBlock}>
              <Text style={styles.eyebrow}>Primary goal</Text>
              <Text style={styles.title}>Define the thing you are actually moving.</Text>
              <GoalBasicsFields
                title={draft.goalTitle}
                targetOutcome={draft.targetOutcome}
                metric={draft.metric}
                hasTargetDate={draft.hasTargetDate}
                targetDate={draft.targetDate}
                autoFocus
                onChangeTitle={(value) => setDraft((current) => ({ ...current, goalTitle: value }))}
                onChangeTargetOutcome={(value) =>
                  setDraft((current) => ({ ...current, targetOutcome: value }))
                }
                onChangeMetric={(value) => setDraft((current) => ({ ...current, metric: value }))}
                onChangeHasTargetDate={(value) =>
                  setDraft((current) => ({
                    ...current,
                    hasTargetDate: value,
                    targetDate: value ? current.targetDate : '',
                  }))
                }
                onChangeTargetDate={(value) =>
                  setDraft((current) => ({ ...current, targetDate: value }))
                }
              />
              {draft.hasTargetDate && !hasValidTargetDate ? (
                <Text style={formStyles.helperText}>Use `YYYY-MM-DD` for the target date.</Text>
              ) : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.stepBlock}>
              <Text style={styles.eyebrow}>Why stack</Text>
              <Text style={styles.title}>Make the reason usable.</Text>
              <GoalReasonFields
                practicalReason={draft.practicalReason}
                emotionalReason={draft.emotionalReason}
                costOfDrift={draft.costOfDrift}
                onChangePracticalReason={(value) =>
                  setDraft((current) => ({ ...current, practicalReason: value }))
                }
                onChangeEmotionalReason={(value) =>
                  setDraft((current) => ({ ...current, emotionalReason: value }))
                }
                onChangeCostOfDrift={(value) =>
                  setDraft((current) => ({ ...current, costOfDrift: value }))
                }
              />
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.stepBlock}>
              <Text style={styles.eyebrow}>Anchor preview</Text>
              <Text style={styles.title}>Two short lines the app can keep pulling forward.</Text>
              <Text style={formStyles.helperText}>
                These are generated from your reasons. Edit them until they sound true.
              </Text>
              <GoalAnchorFields
                anchorWhy={draft.anchorWhy}
                anchorDrift={draft.anchorDrift}
                onChangeAnchorWhy={(value) =>
                  setDraft((current) => ({ ...current, anchorWhy: value }))
                }
                onChangeAnchorDrift={(value) =>
                  setDraft((current) => ({ ...current, anchorDrift: value }))
                }
              />
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.stepBlock}>
              <Text style={styles.eyebrow}>This week</Text>
              <Text style={styles.title}>Seed one focus for the week ahead.</Text>
              <TextInput
                style={[formStyles.input, formStyles.inputMultiline]}
                value={draft.weeklyFocus}
                onChangeText={(value) => setDraft((current) => ({ ...current, weeklyFocus: value }))}
                placeholder="What is the one thing to advance this week?"
                placeholderTextColor={C.textMuted}
                autoFocus
                multiline
                numberOfLines={3}
                maxLength={160}
              />
            </View>
          ) : null}

          {step === 5 ? (
            <View style={styles.stepBlock}>
              <Text style={styles.eyebrow}>Finish</Text>
              <Text style={styles.title}>You are ready to land in Today.</Text>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Goal</Text>
                <Text style={styles.summaryTitle}>{draft.goalTitle}</Text>
                <Text style={styles.summaryBody}>{draft.targetOutcome}</Text>

                <View style={styles.summaryDivider} />
                <Text style={styles.summaryLabel}>Why this matters</Text>
                <Text style={styles.summaryBody}>{draft.anchorWhy}</Text>

                <View style={styles.summaryDivider} />
                <Text style={styles.summaryLabel}>Cost of drift</Text>
                <Text style={styles.summaryBody}>{draft.anchorDrift}</Text>

                <View style={styles.summaryDivider} />
                <Text style={styles.summaryLabel}>This week</Text>
                <Text style={styles.summaryBody}>{draft.weeklyFocus}</Text>
              </View>
            </View>
          ) : null}

          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleBack} activeOpacity={0.8}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.footerSpacer} />
          )}

          {step === TOTAL_STEPS - 1 ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleFinish} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Start Today</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={!canContinue}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressText: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: C.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 999,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  stepBlock: {
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    color: C.accent,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.5,
  },
  copy: {
    fontSize: 16,
    lineHeight: 24,
    color: C.textSecondary,
    marginTop: 4,
  },
  summaryCard: {
    marginTop: 12,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  summaryBody: {
    fontSize: 15,
    lineHeight: 22,
    color: C.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 14,
  },
  errorText: {
    fontSize: 14,
    color: C.danger,
    lineHeight: 20,
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  footerSpacer: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: C.surfaceSecondary,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textSecondary,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: C.accent,
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
