import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecipeCard } from '@/components/recipes/recipe-card';
import { Button, Callout, Chip, Text } from '@/components/ui';
import type { MealType } from '@/domain/journal/types';
import { MEAL_TYPES } from '@/domain/journal/types';
import { useRecipes } from '@/hooks/use-recipes';
import { useTheme } from '@/hooks/use-theme';
import { HEALTH_DISCLAIMER } from '@/lib/legal';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
};

/**
 * Liste des recettes adaptées au profil.
 *
 * Le filtre par moment de la journée **remonte** les recettes adaptées sans
 * exclure les autres : personne ne doit se voir refuser un dahl parce qu'il le
 * mange au petit-déjeuner.
 */
export default function RecipesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [mealType, setMealType] = useState<MealType | undefined>(undefined);

  const result = useRecipes({ mealType });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}>
          <View style={styles.heading}>
            <Text variant="caption" tone="textMuted">
              Recettes
            </Text>
            <Text variant="title">Des idées pour toi</Text>
          </View>

          {/* Une allergie que le filtrage ne sait pas reconnaître doit être
              dite : laisser croire à une protection absente serait pire que
              d'admettre la limite. */}
          {result && result.unrecognisedAllergies.length > 0 ? (
            <Callout
              tone="caution"
              title="Une allergie n’est pas prise en compte"
              body={
                `Le filtrage ne sait pas repérer ${result.unrecognisedAllergies.join(', ')} dans ` +
                `nos recettes. Vérifie toi-même la liste des ingrédients avant de cuisiner.`
              }
              testID="recipes-unrecognised-allergies"
            />
          ) : null}

          <View style={styles.filters} accessibilityRole="radiogroup" testID="recipes-filters">
            <Chip
              role="radio"
              label="Tout"
              selected={mealType === undefined}
              onPress={() => setMealType(undefined)}
              testID="recipes-filter-all"
            />
            {MEAL_TYPES.map((candidate) => (
              <Chip
                role="radio"
                key={candidate}
                label={MEAL_LABELS[candidate]}
                selected={mealType === candidate}
                onPress={() => setMealType(candidate)}
                testID={`recipes-filter-${candidate}`}
              />
            ))}
          </View>

          {result && result.recipes.length > 0 ? (
            result.recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() =>
                  router.push({ pathname: '/recipes/[id]', params: { id: recipe.id } })
                }
                testID={`recipe-${recipe.id}`}
              />
            ))
          ) : (
            <Text variant="body" tone="textMuted" testID="recipes-empty">
              Aucune recette ne correspond à ton profil pour le moment. Le catalogue s’étoffera au
              fil des mises à jour.
            </Text>
          )}

          <Text variant="caption" tone="textMuted" style={styles.note}>
            {HEALTH_DISCLAIMER}
          </Text>

          <Button
            label="Revenir au journal"
            variant="secondary"
            onPress={() => router.back()}
            testID="recipes-back"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%' },
  content: { padding: 24, gap: 12, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { textAlign: 'center' },
});
