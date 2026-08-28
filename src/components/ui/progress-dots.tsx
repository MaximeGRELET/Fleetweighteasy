import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export interface ProgressDotsProps {
  /** Étape courante, à partir de 1. */
  step: number;
  total: number;
}

/** Progression discrète : l'utilisateur sait où il en est, sans compte à rebours. */
export function ProgressDots({ step, total }: ProgressDotsProps) {
  const theme = useTheme();

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Étape ${step} sur ${total}`}
    >
      {Array.from({ length: total }, (_unused, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index < step ? theme.colors.primary : theme.colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 18, height: 4, borderRadius: 2 },
});
