import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui';
import { ALLERGEN_LABELS } from '@/domain/recipes/allergens';
import type { ResolvedRecipe } from '@/domain/recipes/types';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal } from '@/lib/format';

export interface RecipeCardProps {
  recipe: ResolvedRecipe;
  onPress: () => void;
  testID?: string;
}

const DIFFICULTY_LABELS = {
  easy: 'Facile',
  medium: 'Intermédiaire',
  hard: 'Exigeant',
} as const;

/**
 * Une recette dans la liste.
 *
 * Les allergènes sont affichés même quand ils ne concernent pas l'utilisateur :
 * une allergie peut n'avoir pas été déclarée, et quelqu'un cuisine souvent pour
 * d'autres que lui.
 */
export function RecipeCard({ recipe, onPress, testID }: RecipeCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name}, ${formatKcal(recipe.nutritionPerServing.kcal)} par portion`}
      testID={testID}
      onPress={onPress}
      style={[
        styles.card,
        {
          borderRadius: theme.radius.lg,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Text variant="subheading">{recipe.name}</Text>

      <Text variant="caption" tone="textMuted">
        {recipe.prepTimeMin} min · {DIFFICULTY_LABELS[recipe.difficulty]} ·{' '}
        {formatKcal(recipe.nutritionPerServing.kcal)} par portion
      </Text>

      <Text variant="caption" tone="textMuted">
        {recipe.nutritionPerServing.proteinG} g de protéines · {recipe.nutritionPerServing.carbsG} g
        de glucides · {recipe.nutritionPerServing.fatG} g de lipides
      </Text>

      {recipe.allergens.length > 0 ? (
        <Text variant="caption" tone="caution" testID={testID ? `${testID}-allergens` : undefined}>
          Contient : {recipe.allergens.map((allergen) => ALLERGEN_LABELS[allergen]).join(', ')}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', padding: 16, gap: 4, borderWidth: StyleSheet.hairlineWidth },
});
