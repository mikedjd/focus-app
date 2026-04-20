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
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(model);

  useEffect(() => {
    setDraftKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setDraftModel(model);
  }, [model]);

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
});
