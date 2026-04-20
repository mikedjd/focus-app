import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../src/constants/colors';
import { useGoals } from '../src/hooks/useGoals';
import { useInbox } from '../src/hooks/useInbox';
import { useTriageSettings } from '../src/hooks/useTriageSettings';
import type { InboxClassification, InboxItem } from '../src/types';

const LABEL: Record<InboxClassification, string> = {
  today_task: 'Today',
  admin: 'Admin',
  milestone: 'Milestone',
  parking_lot: 'Parking lot',
  someday: 'Someday',
  unknown: 'Needs triage',
};

const CYCLE: InboxClassification[] = [
  'today_task',
  'admin',
  'milestone',
  'parking_lot',
  'someday',
  'unknown',
];

function nextClass(c: InboxClassification | null): InboxClassification {
  if (!c) return CYCLE[0];
  const i = CYCLE.indexOf(c);
  return CYCLE[(i + 1) % CYCLE.length];
}

export default function InboxScreen() {
  const router = useRouter();
  const { activeGoal } = useGoals();
  const { items, capture, reclassify, applyClassification, dismiss } = useInbox(
    activeGoal?.id ?? null
  );
  const { llmEnabled, apiKey } = useTriageSettings();
  const [draft, setDraft] = useState('');
  const [capturing, setCapturing] = useState(false);

  const submit = () => {
    if (draft.trim().length === 0) return;
    setCapturing(true);
    void capture(draft.trim()).finally(() => {
      setCapturing(false);
      setDraft('');
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Inbox</Text>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
          <Ionicons name="settings-outline" size={20} color={C.text} />
        </Pressable>
      </View>

      <View style={styles.captureBox}>
        <View style={styles.modeRow}>
          <Text style={styles.modeLabel}>Triage mode</Text>
          <Text style={styles.modeValue}>
            {llmEnabled ? (apiKey.trim() ? 'Claude' : 'Claude needs key') : 'Rules only'}
          </Text>
        </View>
        <TextInput
          style={styles.captureInput}
          placeholder="Brain dump — we'll sort it"
          placeholderTextColor={C.textMuted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          multiline
        />
        <Pressable style={styles.captureBtn} onPress={submit} disabled={capturing}>
          <Text style={styles.captureBtnText}>{capturing ? 'Sorting…' : 'Capture'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 && (
          <Text style={styles.empty}>
            Nothing pending. Type what's on your mind above — we'll route it.
          </Text>
        )}
        {items.map((item) => (
          <InboxRow
            key={item.id}
            item={item}
            onCycle={() =>
              reclassify(item.id, nextClass(item.classifiedAs), {
                scheduledFor: item.scheduledFor,
                effortLevel: item.effortLevel,
              })
            }
            onApply={() => applyClassification(item)}
            onDismiss={() => dismiss(item.id)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function InboxRow({
  item,
  onCycle,
  onApply,
  onDismiss,
}: {
  item: InboxItem;
  onCycle: () => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const label = item.classifiedAs ? LABEL[item.classifiedAs] : LABEL.unknown;
  return (
    <View style={styles.card}>
      <Text style={styles.cardText}>{item.rawText}</Text>
      {item.scheduledFor ? (
        <Text style={styles.cardMeta}>scheduled: {item.scheduledFor}</Text>
      ) : null}
      {item.effortLevel ? (
        <Text style={styles.cardMeta}>effort: {item.effortLevel}</Text>
      ) : null}
      <View style={styles.cardActions}>
        <Pressable style={[styles.chip, styles.chipLabel]} onPress={onCycle}>
          <Text style={styles.chipLabelText}>{label} ▸</Text>
        </Pressable>
        <Pressable style={[styles.chip, styles.chipApply]} onPress={onApply}>
          <Text style={styles.chipApplyText}>Apply</Text>
        </Pressable>
        <Pressable style={[styles.chip, styles.chipDismiss]} onPress={onDismiss} hitSlop={6}>
          <Ionicons name="close" size={14} color={C.textSecondary} />
        </Pressable>
      </View>
    </View>
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
  captureBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modeLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  modeValue: {
    color: C.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  captureInput: {
    color: C.text,
    fontSize: 15,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  captureBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.accent,
    borderRadius: 8,
  },
  captureBtnText: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, paddingBottom: 40 },
  empty: {
    textAlign: 'center',
    color: C.textSecondary,
    fontStyle: 'italic',
    padding: 20,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardText: { color: C.text, fontSize: 15 },
  cardMeta: { color: C.textSecondary, fontSize: 12, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chipLabel: { backgroundColor: C.surfaceSecondary },
  chipLabelText: { color: C.text, fontSize: 12, fontWeight: '600' },
  chipApply: { backgroundColor: C.accent },
  chipApplyText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  chipDismiss: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
  },
});
