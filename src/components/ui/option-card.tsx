import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

export interface OptionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Signale l'option recommandée, sans culpabiliser les autres. */
  recommended?: boolean;
  testID?: string;
}

/** Choix unique. Le libellé décrit concrètement l'option, pas un jargon. */
export function OptionCard({
  label,
  description,
  selected,
  onPress,
  recommended = false,
  testID,
}: OptionCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={[
        styles.card,
        {
          borderRadius: theme.radius.md,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          backgroundColor: selected ? theme.colors.primaryMuted : theme.colors.surface,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="subheading">{label}</Text>
        {recommended ? (
          <Text variant="caption" tone="primary">
            Recommandé
          </Text>
        ) : null}
      </View>
      {description ? (
        <Text variant="caption" tone="textMuted">
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
