import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, StatusMessage, Text } from '@/components/ui';
import type { MealType } from '@/domain/journal/types';
import { MEAL_TYPES } from '@/domain/journal/types';
import { ALLERGEN_LABELS } from '@/domain/recipes/allergens';
import { INGREDIENTS_BY_ID } from '@/domain/recipes/content/ingredients';
import { useLogRecipe, useRecipe } from '@/hooks/use-recipes';
import { useTheme } from '@/hooks/use-theme';
import { formatGrams, formatKcal } from '@/lib/format';
import { readStringParam } from '@/lib/route-params';
import { todayIsoDate } from '@/stores/session';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
};

const STATE_LABELS = {
  raw: 'cru',
  cooked: 'cuit',
  as_sold: '',
} as const;

/**
 * Détail d'une recette, et ajout au journal.
 *
 * L'état des ingrédients — cru ou cuit — est affiché : 100 g de riz cru ne sont
 * pas 100 g de riz cuit, et peser au mauvais moment fausserait la journée d'un
 * facteur trois.
 */
export default function RecipeDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  const recipe = useRecipe(readStringParam(params.id));
  const logRecipe = useLogRecipe();

  const [portions, setPortions] = useState(1);
  const [loggedTo, setLoggedTo] = useState<MealType>();

  if (!recipe) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.content}>
            <Text variant="body" tone="textMuted" testID="recipe-unknown">
              Cette recette n’existe plus dans le catalogue.
            </Text>
            <Button label="Revenir" variant="secondary" onPress={() => router.back()} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  function addToJournal(mealType: MealType) {
    if (!recipe) {
      return;
    }

    logRecipe({ recipe, mealType, portions, date: todayIsoDate() });
    setLoggedTo(mealType);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}>
          <View style={styles.heading}>
            <Text variant="caption" tone="textMuted">
              {recipe.prepTimeMin} min · {recipe.servings} portion
              {recipe.servings > 1 ? 's' : ''}
            </Text>
            <Text variant="title">{recipe.name}</Text>
          </View>

          <Text variant="body" tone="textMuted" testID="recipe-nutrition">
            Par portion : {formatKcal(recipe.nutritionPerServing.kcal)} ·{' '}
            {recipe.nutritionPerServing.proteinG} g de protéines ·{' '}
            {recipe.nutritionPerServing.carbsG} g de glucides · {recipe.nutritionPerServing.fatG} g
            de lipides
          </Text>

          {recipe.allergens.length > 0 ? (
            <Text variant="body" tone="caution" testID="recipe-allergens">
              Contient : {recipe.allergens.map((allergen) => ALLERGEN_LABELS[allergen]).join(', ')}
            </Text>
          ) : null}

          <Text variant="subheading" style={styles.section}>
            Ingrédients
          </Text>
          <Text variant="caption" tone="textMuted">
            Pour la recette entière ({recipe.servings} portion
            {recipe.servings > 1 ? 's' : ''}).
          </Text>

          {recipe.ingredients.map((ingredient) => {
            const ref = INGREDIENTS_BY_ID.get(ingredient.refId);
            const state = ref ? STATE_LABELS[ref.state] : '';

            return (
              <Text key={ingredient.refId} variant="body" testID={`ingredient-${ingredient.refId}`}>
                {ref?.name ?? ingredient.refId} —{' '}
                {ingredient.display ?? formatGrams(ingredient.quantityG)}
                {state ? ` (${state})` : ''}
              </Text>
            );
          })}

          <Text variant="subheading" style={styles.section}>
            Préparation
          </Text>
          {recipe.steps.map((step, index) => (
            <Text key={step} variant="body" testID={`recipe-step-${index}`}>
              {`${index + 1}. ${step}`}
            </Text>
          ))}

          <Text variant="subheading" style={styles.section}>
            Ajouter au journal
          </Text>

          <View style={styles.portions}>
            <Button
              label="−"
              variant="secondary"
              accessibilityLabel="Une demi-portion de moins"
              onPress={() => setPortions((current) => Math.max(0.5, current - 0.5))}
              testID="recipe-portions-less"
            />
            <Text variant="body" testID="recipe-portions">
              {portions} portion{portions > 1 ? 's' : ''}
            </Text>
            <Button
              label="+"
              variant="secondary"
              accessibilityLabel="Une demi-portion de plus"
              onPress={() => setPortions((current) => current + 0.5)}
              testID="recipe-portions-more"
            />
          </View>

          <View style={styles.meals}>
            {MEAL_TYPES.map((mealType) => (
              <Button
                key={mealType}
                label={MEAL_LABELS[mealType]}
                variant="secondary"
                onPress={() => addToJournal(mealType)}
                testID={`recipe-log-${mealType}`}
              />
            ))}
          </View>

          {loggedTo ? (
            <StatusMessage
              tone="primary"
              message={`Ajouté à ton ${MEAL_LABELS[loggedTo].toLowerCase()}.`}
              testID="recipe-logged"
            />
          ) : null}

          <Button
            label="Revenir aux recettes"
            variant="secondary"
            onPress={() => router.back()}
            testID="recipe-back"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%' },
  content: { padding: 24, gap: 8, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
  section: { marginTop: 12 },
  portions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meals: { gap: 8 },
});
