import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { AdviceBlock } from '@/domain/advice/types';
import { useTheme } from '@/hooks/use-theme';

export interface AdviceCardProps {
  block: AdviceBlock;
  /** Libellé de section, affiché au-dessus du titre. */
  eyebrow?: string;
  testID?: string;
}

/**
 * Une brique de conseil.
 *
 * Sobre et sans ornement : pas d'icône de trophée, pas de couleur d'alerte, pas
 * de badge. Le positionnement produit exclut la gamification
 * (PLAN_IMPLEMENTATION §1.6), et un conseil sur le sommeil n'a pas à ressembler
 * à une récompense.
 */
export function AdviceCard({ block, eyebrow, testID }: AdviceCardProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[
        styles.card,
        {
          borderRadius: theme.radius.lg,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {eyebrow ? (
        <Text variant="caption" tone="textMuted">
          {eyebrow}
        </Text>
      ) : null}

      <Text variant="subheading">{block.title}</Text>
      <Text variant="body" tone="textMuted">
        {block.body}
      </Text>

      {block.sources && block.sources.length > 0 ? (
        <Text variant="caption" tone="textMuted" style={styles.sources}>
          {block.sources.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', padding: 16, gap: 6, borderWidth: StyleSheet.hairlineWidth },
  sources: { marginTop: 4 },
});
