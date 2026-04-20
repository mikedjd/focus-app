import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { C } from '../../constants/colors';
import type { BrainDumpItem } from '../../types';

interface Props {
  items: BrainDumpItem[];
  onCapture: (text: string) => void;
  onDelete: (id: string) => void;
  onPromoteToTask: (item: BrainDumpItem) => void;
}

export function BrainDumpCard({ items, onCapture, onDelete, onPromoteToTask }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [ideasExpanded, setIdeasExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggleExpanded = () => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (expanded) setIdeasExpanded(false);
    setExpanded((v) => !v);
    if (!expanded) setTimeout(() => inputRef.current?.focus(), 250);
  };

  const handleCapture = () => {
    if (!inputText.trim()) return;
    onCapture(inputText.trim());
    setInputText('');
    setIdeasExpanded(false);
  };

  const chevronRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.card}>
      {/* Header — always visible */}
      <TouchableOpacity style={styles.header} onPress={toggleExpanded} activeOpacity={0.75}>
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>⚡</Text>
          <View>
            <Text style={styles.title}>Brain Dump & Future Ideas</Text>
            <Text style={styles.subtitle}>
              {items.length === 0 ? 'Capture ideas without losing focus' : `${items.length} idea${items.length === 1 ? '' : 's'} parked`}
            </Text>
          </View>
        </View>
        <Animated.Text style={[styles.chevron, { transform: [{ rotate: chevronRotate }] }]}>
          ›
        </Animated.Text>
      </TouchableOpacity>

      {/* Expanded body */}
      {expanded ? (
        <View style={styles.body}>
          {/* Quick capture input */}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="What's on your mind? Park it here..."
              placeholderTextColor={C.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleCapture}
              multiline={false}
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.captureBtn, !inputText.trim() && styles.captureBtnDisabled]}
              onPress={handleCapture}
              disabled={!inputText.trim()}
            >
              <Text style={styles.captureBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          {items.length > 0 ? (
            <View style={styles.ideasSection}>
              <TouchableOpacity
                style={styles.ideasToggle}
                onPress={() => setIdeasExpanded((value) => !value)}
                activeOpacity={0.75}
              >
                <View>
                  <Text style={styles.ideasTitle}>Parked ideas</Text>
                  <Text style={styles.ideasSubtitle}>Keep these tucked away until you want them.</Text>
                </View>
                <Text style={styles.ideasToggleText}>
                  {ideasExpanded ? 'Hide' : `Show ${items.length}`}
                </Text>
              </TouchableOpacity>

              {ideasExpanded ? (
                <View style={styles.list}>
                  {items.map((item) => (
                    <View key={item.id} style={styles.item}>
                      <Text style={styles.itemText} numberOfLines={3}>{item.text}</Text>
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={styles.promoteBtn}
                          onPress={() => onPromoteToTask(item)}
                        >
                          <Text style={styles.promoteBtnText}>→ Task</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => onDelete(item.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.deleteBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.emptyHint}>
              Ideas you park here won't clutter your daily tasks.{'\n'}Promote to a task when you're ready.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  icon: { fontSize: 20 },
  title: { fontSize: 15, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
  chevron: {
    fontSize: 22,
    color: C.textMuted,
    fontWeight: '300',
    lineHeight: 24,
    transform: [{ rotate: '0deg' }],
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 14,
    gap: 12,
  },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  captureBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  captureBtnDisabled: { opacity: 0.4 },
  captureBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  list: { gap: 8 },
  ideasSection: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  ideasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  ideasTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  ideasSubtitle: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  ideasToggleText: { fontSize: 12, color: C.accent, fontWeight: '700' },
  item: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  itemText: { fontSize: 14, color: C.text, lineHeight: 20, flex: 1 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoteBtn: {
    backgroundColor: C.accentLight,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  promoteBtnText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  deleteBtn: { marginLeft: 'auto' },
  deleteBtnText: { fontSize: 13, color: C.textMuted },
  emptyHint: {
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 19,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
