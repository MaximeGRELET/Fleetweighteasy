import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { MEAL_TYPE_LABELS } from '@/components/journal/meal-section';
import { Button, Callout, Chip, Text } from '@/components/ui';
import type { FoodItem, Meal } from '@/domain/food/types';
import { snapshotForMeal } from '@/domain/journal/snapshot';
import { MEAL_TYPES, type MealType } from '@/domain/journal/types';
import { useMeals } from '@/hooks/use-food-library';
import { useJournal } from '@/hooks/use-journal';
import { useRepositories } from '@/hooks/use-repositories';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal } from '@/lib/format';
import { useSessionStore } from '@/stores/session';

/**
 * Repas prédéfinis : composer une fois, rejouer en un tap.
 *
 * Entièrement local, donc utilisable hors ligne — c'est même le chemin le plus
 * rapide de l'app, puisqu'il ne consulte aucune source distante.
 */
export default function MealsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const library = useMeals();
  const repositories = useRepositories();
  const selectedDate = useSessionStore((state) => state.selectedDate);
  const journal = useJournal(selectedDate);

  const [pendingMeal, setPendingMeal] = useState<Meal | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);

  function replay(meal: Meal, mealType: MealType) {
    try {
      journal.addMealEntry({ meal, servings: 1, mealType });
      setPendingMeal(undefined);
      setFailure(undefined);
      router.replace('/');
    } catch {
      // `snapshotForMeal` refuse un repas dont un composant a disparu : mieux
      // vaut le dire que journaliser un repas amputé en silence.
      setFailure(
        'Un aliment de ce repas n’est plus disponible. Modifie le repas avant de le rejouer.',
      );
    }
  }

  return (
    <Screen
      title="Mes repas"
      subtitle="Des compositions que tu peux ajouter à ton journal en un tap."
      testID="meals"
      footer={
        <Button
          label="Composer un repas"
          onPress={() => router.push('/meals/new')}
          testID="meals-create"
        />
      }
    >
      {failure ? (
        <Callout tone="caution" title="Repas incomplet" body={failure} testID="meals-failure" />
      ) : null}

      {library.meals.length === 0 ? (
        <Text variant="body" tone="textMuted" testID="meals-empty">
          Tu n’as pas encore de repas enregistré. Compose-en un à partir de tes aliments : tu
          pourras ensuite l’ajouter en un seul geste.
        </Text>
      ) : null}

      {library.meals.map((meal) => {
        const kcal = safeMealKcal(meal, (id) => repositories.food.getById(id));

        return (
          <View
            key={meal.id}
            testID={`meal-${meal.id}`}
            style={[
              styles.card,
              {
                borderRadius: theme.radius.md,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <View style={styles.header}>
              <Text variant="subheading">{meal.name}</Text>
              <Text variant="caption" tone="textMuted">
                {kcal === undefined ? 'Composition incomplète' : formatKcal(kcal)}
              </Text>
            </View>

            <Text variant="caption" tone="textMuted">
              {library.resolveItems(meal).length} aliment
              {library.resolveItems(meal).length > 1 ? 's' : ''}
            </Text>

            {pendingMeal?.id === meal.id ? (
              <View style={styles.chips} testID={`meal-${meal.id}-targets`}>
                {MEAL_TYPES.map((type) => (
                  <Chip
                    key={type}
                    label={MEAL_TYPE_LABELS[type]}
                    selected={false}
                    onPress={() => replay(meal, type)}
                    testID={`meal-${meal.id}-to-${type}`}
                  />
                ))}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                testID={`meal-${meal.id}-replay`}
                onPress={() => setPendingMeal(meal)}
                hitSlop={8}
              >
                <Text variant="caption" tone="primary">
                  + Ajouter au journal
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </Screen>
  );
}

/**
 * Énergie d'un repas, ou `undefined` si un composant manque.
 *
 * Le domaine lève dans ce cas ; ici on ne fait qu'afficher une liste, une
 * exception ferait tomber tout l'écran pour un seul repas abîmé.
 */
function safeMealKcal(
  meal: Meal,
  resolve: (id: string) => FoodItem | undefined,
): number | undefined {
  try {
    return snapshotForMeal(meal, resolve).kcal;
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  card: { width: '100%', padding: 12, gap: 6, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
