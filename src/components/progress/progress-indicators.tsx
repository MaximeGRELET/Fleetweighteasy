import { StyleSheet, View } from 'react-native';

import { ProgressBar, Text } from '@/components/ui';
import type { GoalProgress, ProgressSummary } from '@/domain/progress/summary';
import { useTheme } from '@/hooks/use-theme';
import { formatKg, formatWeeklyRate } from '@/lib/format';

export interface ProgressIndicatorsProps {
  summary: ProgressSummary;
  testID?: string;
}

/**
 * Les trois indicateurs de la phase : variation sur la période, rythme réel
 * face au rythme visé, progression vers la cible.
 *
 * Aucun n'est coloré en rouge ni assorti d'une icône de réussite ou d'échec.
 * Un chiffre qui monte est présenté du même ton qu'un chiffre qui descend :
 * c'est le texte d'explication, juste à côté, qui porte le sens.
 */
export function ProgressIndicators({ summary, testID }: ProgressIndicatorsProps) {
  const theme = useTheme();

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
      <Indicator
        label="Sur la période"
        value={
          summary.changeKg === undefined ? 'Pas encore mesurable' : formatSignedKg(summary.changeKg)
        }
        testID="indicator-change"
      />

      <Indicator
        label="Rythme réel"
        value={
          summary.observed
            ? formatSignedWeeklyRate(summary.observed.weeklyRateKg)
            : 'Encore trop tôt pour le dire'
        }
        hint={`Visé : ${formatWeeklyRate(summary.plannedWeeklyLossKg)}`}
        testID="indicator-rate"
      />

      {summary.goal ? (
        <View style={styles.goal}>
          <ProgressBar
            label="Vers ton objectif"
            tone="primary"
            ratio={summary.goal.ratio}
            value={`${formatKg(summary.goal.currentWeightKg)} → ${formatKg(summary.goal.targetWeightKg)}`}
            accessibilityLabel={buildGoalLabel(summary.goal)}
            testID="indicator-goal"
          />
          <Text variant="caption" tone="textMuted">
            {summary.goal.remainingKg > 0
              ? `Encore ${formatKg(summary.goal.remainingKg)} depuis ${formatKg(summary.goal.startWeightKg)} au départ.`
              : `Objectif atteint, depuis ${formatKg(summary.goal.startWeightKg)} au départ.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Indicator({
  label,
  value,
  hint,
  testID,
}: {
  label: string;
  value: string;
  hint?: string;
  testID: string;
}) {
  return (
    <View style={styles.indicator}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      <Text variant="subheading" testID={testID}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Variation signée, avec son sens écrit en toutes lettres.
 *
 * Un « −2,4 kg » isolé se lit mal en diagonale, et le signe moins typographique
 * disparaît à petite taille. Le mot lève l'ambiguïté.
 */
function formatSignedKg(changeKg: number): string {
  if (changeKg < 0) {
    return `${formatKg(Math.abs(changeKg))} perdus`;
  }

  if (changeKg > 0) {
    return `${formatKg(changeKg)} pris`;
  }

  return 'Stable';
}

function formatSignedWeeklyRate(weeklyRateKg: number): string {
  if (weeklyRateKg < 0) {
    return `−${formatWeeklyRate(Math.abs(weeklyRateKg))}`;
  }

  if (weeklyRateKg > 0) {
    return `+${formatWeeklyRate(weeklyRateKg)}`;
  }

  return 'Stable';
}

function buildGoalLabel(goal: GoalProgress): string {
  return (
    `Progression vers ton objectif : ${formatKg(goal.currentWeightKg)} aujourd’hui, ` +
    `cible ${formatKg(goal.targetWeightKg)}, départ ${formatKg(goal.startWeightKg)}.`
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', padding: 16, gap: 14, borderWidth: StyleSheet.hairlineWidth },
  indicator: { gap: 2 },
  goal: { gap: 6 },
});
