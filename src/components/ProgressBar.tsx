import { View } from 'react-native';
import { C } from '../constants/colors';

interface Props {
  percent: number; // 0..1
  height?: number;
  color?: string;
  background?: string;
}

export function ProgressBar({
  percent,
  height = 8,
  color = C.accent,
  background = C.surfaceSecondary,
}: Props) {
  const clamped = Math.max(0, Math.min(1, percent));
  return (
    <View
      style={{
        height,
        backgroundColor: background,
        borderRadius: height / 2,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${clamped * 100}%`,
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}
