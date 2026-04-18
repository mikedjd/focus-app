import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { DailyTask } from '../types';
import { C } from '../constants/colors';

const SWIPE_THRESHOLD = 80;
const DROP_EXIT = -500;

interface Props {
  task: DailyTask;
  isNextUp?: boolean;
  onToggle: (id: string) => void;
  onFocus: (id: string) => void;
  onDrop: (id: string) => void;
}

export function TaskCard({ task, isNextUp = false, onToggle, onFocus, onDrop }: Props) {
  const done = task.status === 'done';
  const translateX = useRef(new Animated.Value(0)).current;
  const dropping = useRef(false);

  // Clamp revealed drop-zone width for the background hint
  const dropReveal = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 1.5, 0],
    outputRange: [SWIPE_THRESHOLD * 1.5, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      // Don't steal from parent ScrollView on first touch
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Activate when horizontal motion clearly dominates and swipe is leftward
      onMoveShouldSetPanResponder: (_, g) =>
        !done && Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && g.dx < -8,
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: () => {
        dropping.current = false;
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        if (dropping.current) return;
        // Only allow leftward drag
        translateX.setValue(Math.min(0, g.dx));
      },
      onPanResponderRelease: (_, g) => {
        if (dropping.current) return;

        if (g.dx < -SWIPE_THRESHOLD) {
          // Commit drop — fly card off screen then call handler
          dropping.current = true;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Animated.timing(translateX, {
            toValue: DROP_EXIT,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            onDrop(task.id);
          });
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (!dropping.current) {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Drop zone revealed behind card as it swipes left */}
      <Animated.View style={[styles.dropZone, { width: dropReveal }]}>
        <Text style={styles.dropLabel}>Drop</Text>
      </Animated.View>

      <Animated.View
        style={[styles.row, done && styles.rowDone, isNextUp && styles.rowNextUp, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {isNextUp ? <View style={styles.nextUpBar} /> : null}

        <TouchableOpacity
          style={[styles.circle, done && styles.circleDone]}
          onPress={() => onToggle(task.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          accessibilityLabel={done ? 'Mark incomplete' : 'Mark complete'}
        >
          {done && <View style={styles.circleCheck} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.titleArea}
          onPress={() => !done && onFocus(task.id)}
          activeOpacity={done ? 1 : 0.6}
        >
          <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.nextStep ? (
            <Text style={[styles.nextStep, done && styles.titleDone]} numberOfLines={2}>
              Next: {task.nextStep}
            </Text>
          ) : null}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    overflow: 'hidden',
    borderRadius: 12,
  },

  // Red drop zone behind the card
  dropZone: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  rowDone: {
    backgroundColor: C.surfaceSecondary,
    borderColor: 'transparent',
    paddingVertical: 12,
  },
  rowNextUp: {
    borderColor: C.accent,
    borderWidth: 1,
  },
  nextUpBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: C.accent,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },

  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  circleDone: {
    backgroundColor: C.success,
    borderColor: C.success,
  },
  circleCheck: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },

  titleArea: { flex: 1 },
  title: {
    fontSize: 16,
    color: C.text,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  nextStep: {
    marginTop: 4,
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 18,
  },
  titleDone: {
    color: C.textMuted,
    textDecorationLine: 'line-through',
  },
});
