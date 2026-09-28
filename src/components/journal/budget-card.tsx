import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LinkButton, ProgressBar, Text } from '@/components/ui';
import type { DailyBudget } from '@/domain/journal/daily-budget';
import { useTheme } from '@/hooks/use-theme';
import { formatGrams, formatKcal } from '@/lib/format';
import { CALORIE_MODE_EXPLANATIONS } from '@/lib/messages/safety';

export interface BudgetCardProps {
  budget: DailyBudget;
  testID?: string;
}

/**
 * Budget calorique du jour.
 *
 * Deux exigences se rencontrent ici.
 *
 * **Le mode de calories est appliqué, jamais deviné.** Le chiffre affiché vient
 * de `buildDailyBudget` ; l'écran ne fait qu'additionner des pixels.
 *
 * **Le sport est toujours visible, même quand il ne compte pas.** En mode
 * `fixed`, une séance n'augmente pas le budget — mais la masquer donnerait
 * l'impression qu'elle a été oubliée. Elle est donc affichée à part, avec
 * l'explication du mode et la vue alternative à un tap : c'est la transparence
 * demandée par PHASE_1 §7.2, et la seule façon que le mode reste compréhensible.
 */
export function BudgetCard({ budget, testID }: BudgetCardProps) {
  const theme = useTheme();
  const [showAlternative, setShowAlternative] = useState(false);

  const view = showAlternative ? budget.alternative : budget.active;
  const isCredited = view.mode === 'credited';

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          borderRadius: theme.radius.lg,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Text variant="caption" tone="textMuted">
        {view.remainingKcal >= 0 ? 'Il te reste' : 'Tu as dépassé de'}
      </Text>
      <Text variant="numeric" testID="budget-remaining">
        {formatKcal(Math.abs(view.remainingKcal))}
      </Text>

      <Text variant="caption" tone="textMuted" testID="budget-breakdown">
        {formatKcal(budget.consumedKcal)} consommées sur {formatKcal(view.budgetKcal)}
      </Text>

      {/* La dépense sportive est affichée dans les deux modes. Ce qui change,
          c'est seulement si elle entre ou non dans le budget. */}
      {budget.exerciseKcal > 0 ? (
        <Text variant="caption" tone="textMuted" testID="budget-exercise">
          {isCredited
            ? `Dont ${formatKcal(budget.exerciseKcal)} créditées par tes séances`
            : `${formatKcal(budget.exerciseKcal)} estimées en séances, non ajoutées à ce budget`}
        </Text>
      ) : null}

      <Text variant="caption" tone="textMuted" style={styles.explanation} testID="budget-mode">
        {CALORIE_MODE_EXPLANATIONS[view.explanation].body}
      </Text>

      <LinkButton
        label={
          showAlternative
            ? '← Revenir à ton mode'
            : `Voir ce que donnerait le mode ${budget.alternative.mode === 'credited' ? 'avec crédit sportif' : 'sans crédit sportif'}`
        }
        testID="budget-toggle-view"
        onPress={() => setShowAlternative((current) => !current)}
      />

      {showAlternative ? (
        <Text variant="caption" tone="textMuted" testID="budget-alternative-note">
          Vue de comparaison. Ton réglage reste le mode{' '}
          {budget.active.mode === 'credited' ? 'avec crédit sportif' : 'sans crédit sportif'}.
        </Text>
      ) : null}

      <View style={styles.macros}>
        <ProgressBar
          label="Protéines"
          tone="protein"
          ratio={budget.protein.ratio}
          value={`${formatGrams(budget.protein.consumedG)} / ${formatGrams(budget.protein.targetG)}`}
          accessibilityLabel={`Protéines : ${formatGrams(budget.protein.consumedG)} sur ${formatGrams(budget.protein.targetG)}`}
          testID="macro-protein"
        />
        <ProgressBar
          label="Glucides"
          tone="carbs"
          ratio={budget.carbs.ratio}
          value={`${formatGrams(budget.carbs.consumedG)} / ${formatGrams(budget.carbs.targetG)}`}
          accessibilityLabel={`Glucides : ${formatGrams(budget.carbs.consumedG)} sur ${formatGrams(budget.carbs.targetG)}`}
          testID="macro-carbs"
        />
        <ProgressBar
          label="Lipides"
          tone="fat"
          ratio={budget.fat.ratio}
          value={`${formatGrams(budget.fat.consumedG)} / ${formatGrams(budget.fat.targetG)}`}
          accessibilityLabel={`Lipides : ${formatGrams(budget.fat.consumedG)} sur ${formatGrams(budget.fat.targetG)}`}
          testID="macro-fat"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', padding: 16, gap: 4, borderWidth: StyleSheet.hairlineWidth },
  explanation: { marginTop: 8 },
  macros: { marginTop: 16, gap: 12 },
});
