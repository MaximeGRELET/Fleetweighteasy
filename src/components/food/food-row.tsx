import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { FoodItem } from '@/domain/food/types';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal } from '@/lib/format';

import { describeReliability, ReliabilityBadge } from './reliability-badge';

export interface FoodRowProps {
  item: FoodItem;
  onPress: (item: FoodItem) => void;
  /** Marque un aliment déjà présent dans le cache local. */
  availableOffline?: boolean;
  testID?: string;
}

/** Une ligne de résultat : identité, énergie de référence, origine de la donnée. */
export function FoodRow({ item, onPress, availableOffline = false, testID }: FoodRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={describeFoodRow(item, availableOffline)}
      testID={testID}
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.row,
        {
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.identity}>
        <Text variant="subheading" numberOfLines={1}>
          {item.name}
        </Text>
        {item.brand ? (
          <Text variant="caption" tone="textMuted" numberOfLines={1}>
            {item.brand}
          </Text>
        ) : null}

        <View style={styles.meta}>
          <ReliabilityBadge verified={item.verified} source={item.source} />
          {availableOffline ? (
            <Text variant="caption" tone="textMuted">
              Hors ligne
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.energy}>
        <Text variant="subheading">{formatKcal(item.nutritionPer100.kcal)}</Text>
        <Text variant="caption" tone="textMuted">
          pour 100 g
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Ce que lit le lecteur d'écran : l'étiquette remplace le texte des enfants,
 * elle reprend donc l'énergie et l'origine de la donnée, sans lesquelles le
 * choix entre deux résultats se ferait à l'aveugle.
 */
function describeFoodRow(item: FoodItem, availableOffline: boolean): string {
  const parts = [
    item.brand ? `${item.name}, ${item.brand}` : item.name,
    `${formatKcal(item.nutritionPer100.kcal)} pour 100 g`,
    describeReliability(item),
  ];

  if (availableOffline) {
    parts.push('Disponible hors ligne');
  }

  return parts.join('. ');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  identity: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  energy: { alignItems: 'flex-end' },
});
