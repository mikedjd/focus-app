import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
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
import { useEnergyWindows } from '../src/hooks/useEnergyWindows';
import type { EnergyIntensity } from '../src/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function intensityColor(i: EnergyIntensity): string {
  if (i === 'high') return '#E67700';
  if (i === 'medium') return C.accent;
  return C.textSecondary;
}

export default function EnergyWindowsScreen() {
  const router = useRouter();
  const { windows, add, remove, copyToWeekdays } = useEnergyWindows();
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('7');
  const [end, setEnd] = useState('11');
  const [intensity, setIntensity] = useState<EnergyIntensity>('high');

  const submit = () => {
    const s = Number(start);
    const e = Number(end);
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || s > 23 || e < 1 || e > 24 || e <= s) {
      Alert.alert('Invalid window', 'Use whole hours 0–24 and end must be after start.');
      return;
    }
    add(day, s, e, intensity);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Energy Windows</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Tell the app when you're sharp. Challenging work gets slotted into HIGH windows; admin
          filler lands in LOW windows.
        </Text>

        <Text style={styles.label}>Day</Text>
        <View style={styles.rowWrap}>
          {DAYS.map((d, i) => (
            <Pressable
              key={d}
              style={[styles.chip, day === i && styles.chipActive]}
              onPress={() => setDay(i)}
            >
              <Text style={[styles.chipText, day === i && styles.chipTextActive]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Start (0–23)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={start}
              onChangeText={setStart}
              maxLength={2}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>End (1–24)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={end}
              onChangeText={setEnd}
              maxLength={2}
            />
          </View>
        </View>

        <Text style={styles.label}>Intensity</Text>
        <View style={styles.rowWrap}>
          {(['high', 'medium', 'low'] as EnergyIntensity[]).map((i) => (
            <Pressable
              key={i}
              style={[styles.chip, intensity === i && styles.chipActive]}
              onPress={() => setIntensity(i)}
            >
              <Text style={[styles.chipText, intensity === i && styles.chipTextActive]}>
                {i.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.submit} onPress={submit}>
          <Text style={styles.submitText}>Add window</Text>
        </Pressable>

        <Pressable
          style={[styles.submit, styles.copyBtn]}
          onPress={() =>
            Alert.alert(
              'Copy to all weekdays?',
              `Mon–Fri will be replaced with ${DAYS[day]}'s schedule.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Copy', onPress: () => copyToWeekdays(day) },
              ]
            )
          }
        >
          <Text style={styles.copyBtnText}>Copy {DAYS[day]} to all weekdays</Text>
        </Pressable>

        <Text style={[styles.label, { marginTop: 24 }]}>Configured windows</Text>
        {windows.length === 0 && (
          <Text style={styles.empty}>No windows yet — add one above.</Text>
        )}
        {windows.map((w) => (
          <View key={w.id} style={styles.windowRow}>
            <Text style={styles.windowDay}>{DAYS[w.dayOfWeek]}</Text>
            <Text style={styles.windowTime}>
              {String(w.startHour).padStart(2, '0')}:00 – {String(w.endHour).padStart(2, '0')}:00
            </Text>
            <Text style={[styles.windowIntensity, { color: intensityColor(w.intensity) }]}>
              {w.intensity.toUpperCase()}
            </Text>
            <Pressable onPress={() => remove(w.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={C.danger} />
            </Pressable>
          </View>
        ))}
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
  content: { padding: 20, paddingBottom: 60 },
  subtitle: { color: C.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  label: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.textSecondary, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 16,
  },
  submit: {
    marginTop: 16,
    backgroundColor: C.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '600' },
  copyBtn: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  copyBtnText: { color: C.accent, fontWeight: '600' },
  empty: { color: C.textSecondary, fontStyle: 'italic', padding: 12 },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.surface,
    borderRadius: 8,
    marginBottom: 6,
    gap: 12,
  },
  windowDay: { width: 40, fontWeight: '600', color: C.text },
  windowTime: { flex: 1, color: C.text, fontVariant: ['tabular-nums'] },
  windowIntensity: { fontWeight: '700', fontSize: 12 },
});
