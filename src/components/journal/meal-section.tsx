import { Pressable, StyleSheet, View } from 'react-native';

import { LinkButton, Text } from '@/components/ui';
import type { FoodLogEntry, MealType } from '@/domain/journal/types';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal } from '@/lib/format';

/** Libellés des repas. Un seul endroit : l'ordre et les mots sont figés ici. */
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
};

export interface MealSectionProps {
  mealType: MealType;
  entries: FoodLogEntry[];
  kcal: number;
  onAdd: (mealType: MealType) => void;
  onEditEntry: (entryId: string) => void;
  onRemoveEntry: (entryId: string) => void;
  testID?: string;
}

/**
 * Un repas de la journée et ses entrées.
 *
 * Les repas vides sont affichés eux aussi : ils portent l'action « ajouter »,
 * qui est le geste le plus fréquent de l'app. Les masquer économiserait quatre
 * lignes et coûterait un tap à chaque saisie.
 *
 * Chaque ligne affiche le **snapshot** figé à l'ajout, jamais une valeur
 * recalculée depuis l'aliment source (PHASE_2 §2.4).
 */
export function MealSection({
  mealType,
  entries,
  kcal,
  onAdd,
  onEditEntry,
  onRemoveEntry,
  testID,
}: MealSectionProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.section,
        {
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="subheading">{MEAL_TYPE_LABELS[mealType]}</Text>
        <Text variant="caption" tone="textMuted" testID={`meal-${mealType}-kcal`}>
          {formatKcal(kcal)}
        </Text>
      </View>

      {entries.map((entry) => (
        <View key={entry.id} style={styles.entry}>
          {/* Toute la ligne ouvre la correction : c'est la cible la plus large,
              et corriger une quantité est plus fréquent que supprimer. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Corriger ${entry.snapshot.name}`}
            testID={`entry-edit-${entry.id}`}
            onPress={() => onEditEntry(entry.id)}
            style={styles.entryText}
          >
            <Text variant="body" numberOfLines={1}>
              {entry.snapshot.name}
            </Text>
            <Text variant="caption" tone="textMuted">
              {Math.round(entry.quantityG)} g · {formatKcal(entry.snapshot.kcal)}
            </Text>
          </Pressable>

          <LinkButton
            label="Retirer"
            tone="textMuted"
            accessibilityLabel={`Supprimer ${entry.snapshot.name}`}
            testID={`entry-remove-${entry.id}`}
            onPress={() => onRemoveEntry(entry.id)}
          />
        </View>
      ))}

      <LinkButton
        label="+ Ajouter"
        accessibilityLabel={`Ajouter au ${MEAL_TYPE_LABELS[mealType].toLowerCase()}`}
        testID={`meal-${mealType}-add`}
        onPress={() => onAdd(mealType)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', padding: 12, gap: 8, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  entryText: { flex: 1 },
});
