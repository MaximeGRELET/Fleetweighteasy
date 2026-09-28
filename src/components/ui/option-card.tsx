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
      // `checked` pour Android, `selected` pour iOS : voir `Chip`.
      accessibilityState={{ checked: selected, selected }}
      // L'étiquette remplace le texte des enfants : la description et la
      // recommandation doivent y figurer pour être entendues.
      accessibilityLabel={[label, recommended ? 'recommandé' : undefined, description]
        .filter(Boolean)
        .join('. ')}
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
