import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { C } from '../../constants/colors';
import { PROJECT_COLORS } from '../../hooks/useProjects';
import type { Project } from '../../types';

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.72;

interface Props {
  visible: boolean;
  projects: Project[];
  selectedProjectId: string | null;
  taskCountByProject: Record<string, number>;
  onSelectProject: (id: string | null) => void;
  onAddProject: (name: string, color: string) => void;
  onDeleteProject: (id: string) => void;
  onClose: () => void;
}

export function ProjectSidebar({
  visible,
  projects,
  selectedProjectId,
  taskCountByProject,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onClose,
}: Props) {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -SIDEBAR_WIDTH,
      duration: 260,
      useNativeDriver: true,
    }).start();
    if (!visible) {
      setShowAddForm(false);
      setNewName('');
      setNewColor(PROJECT_COLORS[0]);
    }
  }, [visible, slideAnim]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddProject(newName.trim(), newColor);
    setNewName('');
    setNewColor(PROJECT_COLORS[0]);
    setShowAddForm(false);
  };

  const totalCount = Object.values(taskCountByProject).reduce((s, n) => s + n, 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: slideAnim.interpolate({
                  inputRange: [-SIDEBAR_WIDTH, 0],
                  outputRange: [0, 1],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Drawer */}
        <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Projects</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {/* All */}
            <TouchableOpacity
              style={[styles.item, selectedProjectId === null && styles.itemActive]}
              onPress={() => { onSelectProject(null); onClose(); }}
            >
              <View style={[styles.dot, { backgroundColor: C.accent }]} />
              <Text style={[styles.itemLabel, selectedProjectId === null && styles.itemLabelActive]}>
                All tasks
              </Text>
              <Text style={styles.itemCount}>{totalCount}</Text>
            </TouchableOpacity>

            {projects.map((p) => (
              <View key={p.id} style={styles.itemRow}>
                <TouchableOpacity
                  style={[styles.item, styles.itemFlex, selectedProjectId === p.id && styles.itemActive]}
                  onPress={() => { onSelectProject(p.id); onClose(); }}
                >
                  <View style={[styles.dot, { backgroundColor: p.color }]} />
                  <Text
                    style={[styles.itemLabel, selectedProjectId === p.id && styles.itemLabelActive]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  <Text style={styles.itemCount}>{taskCountByProject[p.id] ?? 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => onDeleteProject(p.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Add form */}
            {showAddForm ? (
              <View style={styles.addForm}>
                <TextInput
                  style={styles.nameInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Project name..."
                  placeholderTextColor={C.textMuted}
                  autoFocus
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={handleAdd}
                />
                <View style={styles.colorRow}>
                  {PROJECT_COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorSwatch, { backgroundColor: c }, newColor === c && styles.colorSwatchSelected]}
                      onPress={() => setNewColor(c)}
                    />
                  ))}
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelSmall} onPress={() => setShowAddForm(false)}>
                    <Text style={styles.cancelSmallText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addConfirm, !newName.trim() && styles.addConfirmDisabled]}
                    onPress={handleAdd}
                    disabled={!newName.trim()}
                  >
                    <Text style={styles.addConfirmText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddForm(true)}>
                <Text style={styles.addBtnText}>+ New project</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  drawer: {
    width: SIDEBAR_WIDTH,
    backgroundColor: C.surface,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  closeBtn: { fontSize: 16, color: C.textMuted, fontWeight: '600' },
  list: { flex: 1, paddingTop: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  itemFlex: { flex: 1 },
  itemActive: { backgroundColor: C.accentLight },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemLabel: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  itemLabelActive: { color: C.accent, fontWeight: '600' },
  itemCount: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  deleteBtn: { paddingRight: 16, paddingVertical: 14 },
  deleteBtnText: { fontSize: 12, color: C.textMuted },
  addBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBtnText: { fontSize: 14, color: C.accent, fontWeight: '600' },
  addForm: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  nameInput: {
    fontSize: 15,
    color: C.text,
    borderBottomWidth: 1.5,
    borderBottomColor: C.accent,
    paddingVertical: 6,
  },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorSwatchSelected: { borderWidth: 3, borderColor: C.text },
  formActions: { flexDirection: 'row', gap: 8 },
  cancelSmall: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: C.surfaceSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelSmallText: { fontSize: 14, color: C.textSecondary },
  addConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: C.accent,
    alignItems: 'center',
  },
  addConfirmDisabled: { opacity: 0.4 },
  addConfirmText: { fontSize: 14, color: '#fff', fontWeight: '600' },
});
