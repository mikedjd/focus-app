import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../src/constants/colors';
import {
  DEFAULT_TRIAGE_MODEL,
  useTriageSettings,
} from '../src/hooks/useTriageSettings';
import { useDailyRhythmSettings } from '../src/hooks/useDailyRhythmSettings';
import { DAILY_PHASES, getPhaseTimeLabel } from '../src/utils/dailyPhases';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    llmEnabled,
    model,
    apiKey,
    setLlmEnabled,
    setModel,
    setApiKey,
  } = useTriageSettings();
  const {
    wakeTime,
    defaultFocusMinutes,
    defaultBreakMinutes,
    focusModeAssistEnabled,
    setWakeTime,
    setDefaultFocusMinutes,
    setDefaultBreakMinutes,
    setFocusModeAssistEnabled,
  } = useDailyRhythmSettings();
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(model);
  const [draftWakeTime, setDraftWakeTime] = useState(wakeTime);
  const [draftFocusMinutes, setDraftFocusMinutes] = useState(String(defaultFocusMinutes));
  const [draftBreakMinutes, setDraftBreakMinutes] = useState(String(defaultBreakMinutes));

  useEffect(() => {
    setDraftKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setDraftModel(model);
  }, [model]);

  useEffect(() => {
    setDraftWakeTime(wakeTime);
  }, [wakeTime]);

  useEffect(() => {
    setDraftFocusMinutes(String(defaultFocusMinutes));
  }, [defaultFocusMinutes]);

  useEffect(() => {
    setDraftBreakMinutes(String(defaultBreakMinutes));
  }, [defaultBreakMinutes]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily rhythm</Text>
          <Text style={styles.cardText}>
            The app uses your wake time to map the day into three ADHD-friendly phases.
          </Text>

          <Text style={styles.label}>Wake time</Text>
          <TextInput
            style={styles.input}
            value={draftWakeTime}
            onChangeText={setDraftWakeTime}
            placeholder="07:00"
            placeholderTextColor={C.textMuted}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            onBlur={() => setWakeTime(draftWakeTime)}
          />

          <View style={styles.timerRow}>
            <View style={styles.timerField}>
              <Text style={styles.label}>Default focus (min)</Text>
              <TextInput
                style={styles.input}
                value={draftFocusMinutes}
                onChangeText={setDraftFocusMinutes}
                keyboardType="number-pad"
                maxLength={3}
                onBlur={() => setDefaultFocusMinutes(Number(draftFocusMinutes))}
              />
            </View>
            <View style={styles.timerField}>
              <Text style={styles.label}>Default break (min)</Text>
              <TextInput
                style={styles.input}
                value={draftBreakMinutes}
                onChangeText={setDraftBreakMinutes}
                keyboardType="number-pad"
                maxLength={2}
                onBlur={() => setDefaultBreakMinutes(Number(draftBreakMinutes))}
              />
            </View>
          </View>

          <View style={[styles.row, styles.rowTopSpacing]}>
            <View style={styles.copy}>
              <Text style={styles.cardTitle}>Phone focus assist</Text>
              <Text style={styles.cardText}>
                On focus start, the app can try to open your phone&apos;s focus or do-not-disturb settings.
              </Text>
            </View>
            <Switch value={focusModeAssistEnabled} onValueChange={setFocusModeAssistEnabled} />
          </View>

          <View style={styles.phaseList}>
            {DAILY_PHASES.map((phase) => (
              <View key={phase.id} style={styles.phaseRow}>
                <Text style={styles.phaseTitle}>{phase.title}</Text>
                <Text style={styles.phaseMeta}>{getPhaseTimeLabel(phase.id, wakeTime)}</Text>
                <Text style={styles.phaseCopy}>{phase.summary}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.cardTitle}>Claude inbox triage</Text>
              <Text style={styles.cardText}>
                When enabled, new inbox captures are classified by Claude first and fall back to rules if the request fails.
              </Text>
            </View>
            <Switch value={llmEnabled} onValueChange={setLlmEnabled} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Anthropic API key</Text>
          <TextInput
            style={styles.input}
            value={draftKey}
            onChangeText={setDraftKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder="sk-ant-..."
            placeholderTextColor={C.textMuted}
            onBlur={() => setApiKey(draftKey)}
          />
          <Text style={styles.helper}>
            Stored locally on this device for now. On web, requests go directly from the browser.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Model</Text>
          <TextInput
            style={styles.input}
            value={draftModel}
            onChangeText={setDraftModel}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={DEFAULT_TRIAGE_MODEL}
            placeholderTextColor={C.textMuted}
            onBlur={() => setModel(draftModel)}
          />
          <Text style={styles.helper}>Default is {DEFAULT_TRIAGE_MODEL}.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: C.text },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  rowTopSpacing: {
    marginTop: 14,
  },
  copy: {
    flex: 1,
  },
  cardTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardText: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: C.text,
    fontSize: 14,
  },
  helper: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  timerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timerField: {
    flex: 1,
  },
  phaseList: {
    marginTop: 16,
    gap: 10,
  },
  phaseRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  phaseTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  phaseMeta: {
    marginTop: 2,
    color: C.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  phaseCopy: {
    marginTop: 4,
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
