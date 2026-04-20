import { useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../src/constants/colors';
import { useParkingLot } from '../src/hooks/useParkingLot';

function formatCooldown(ms: number): string {
  if (ms <= 0) return 'ready';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.ceil(ms / (60 * 1000));
  return `${mins}m`;
}

export default function ParkingLotScreen() {
  const router = useRouter();
  const { items, promote, dismiss } = useParkingLot();

  const now = Date.now();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Parking Lot</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Shiny new ideas get a 7-day cooldown. If it still matters after a week, you can promote
          it to a real goal.
        </Text>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing parked.</Text>
            <Text style={styles.emptySub}>
              When you try to start a new goal while one is already active, it'll land here.
            </Text>
          </View>
        ) : (
          items.map((item) => {
            const msLeft = item.promotableAt - now;
            const ready = msLeft <= 0;
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={[styles.badge, ready ? styles.badgeReady : styles.badgeCooldown]}>
                    <Text style={styles.badgeText}>{formatCooldown(msLeft)}</Text>
                  </View>
                </View>
                {item.why ? <Text style={styles.why}>{item.why}</Text> : null}
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.btn, !ready && styles.btnDisabled]}
                    disabled={!ready}
                    onPress={() => {
                      const promoted = promote(item.id);
                      if (!promoted) {
                        Alert.alert('Not yet', 'Wait until the cooldown is done.');
                      }
                    }}
                  >
                    <Text style={[styles.btnText, !ready && styles.btnTextDisabled]}>Promote</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() =>
                      Alert.alert('Drop this idea?', 'It will be removed.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Drop', style: 'destructive', onPress: () => dismiss(item.id) },
                      ])
                    }
                  >
                    <Text style={styles.btnSecondaryText}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
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
  content: { padding: 20 },
  subtitle: {
    color: C.textSecondary,
    fontSize: 14,
    marginBottom: 18,
    lineHeight: 20,
  },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: C.text, marginBottom: 8 },
  emptySub: {
    color: C.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },
  why: { color: C.textSecondary, marginTop: 4, fontSize: 13 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeCooldown: { backgroundColor: C.surfaceSecondary },
  badgeReady: { backgroundColor: C.successLight },
  badgeText: { fontSize: 11, color: C.text, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: C.accent,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: C.surfaceSecondary },
  btnText: { color: '#fff', fontWeight: '600' },
  btnTextDisabled: { color: C.textMuted },
  btnSecondary: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  btnSecondaryText: { color: C.textSecondary, fontWeight: '600' },
});
