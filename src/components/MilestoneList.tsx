import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import type { Milestone } from '../types';
import { ProgressBar } from './ProgressBar';

interface Props {
  milestones: Milestone[];
  percent: number;
  completed: number;
  total: number;
  onAdd: (title: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export function MilestoneList({
  milestones,
  percent,
  completed,
  total,
  onAdd,
  onToggle,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (draft.trim().length === 0) return;
    onAdd(draft.trim());
    setDraft('');
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Milestones</Text>
        <Text style={styles.count}>{completed}/{total}</Text>
      </View>

      <ProgressBar percent={percent} />

      <View style={{ marginTop: 12 }}>
        {milestones.map((m) => {
          const done = m.completedAt !== null;
          return (
            <Pressable
              key={m.id}
              onPress={() => onToggle(m.id, !done)}
              onLongPress={() => onDelete(m.id)}
              style={({ pressed }) => [
                styles.item,
                pressed && { opacity: 0.6 },
                done && { backgroundColor: C.successLight },
              ]}
            >
              <Ionicons
                name={done ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={done ? C.success : C.textMuted}
              />
              <Text style={[styles.itemText, done && styles.itemTextDone]}>{m.title}</Text>
            </Pressable>
          );
        })}

        {milestones.length === 0 && (
          <Text style={styles.empty}>
            Break this goal into 3–8 smaller wins — you'll stay motivated.
          </Text>
        )}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a milestone…"
          placeholderTextColor={C.textMuted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        <Pressable style={styles.addBtn} onPress={submit}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  title: { fontSize: 16, fontWeight: '600', color: C.text },
  count: { fontSize: 13, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    gap: 10,
  },
  itemText: { color: C.text, fontSize: 15, flex: 1 },
  itemTextDone: { color: C.textSecondary, textDecorationLine: 'line-through' },
  empty: {
    color: C.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    padding: 12,
    textAlign: 'center',
  },
  inputRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
  },
  addBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600' },
});
