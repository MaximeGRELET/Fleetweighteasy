import Slider from '@react-native-community/slider';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StepScreen } from '@/components/onboarding/step-screen';
import { Callout, Text } from '@/components/ui';
import { weeklyRateToDeficitKcal } from '@/domain/nutrition/energy';
import {
  getDefaultWeeklyRateKg,
  getMaxWeeklyRateKg,
  MAX_DAILY_DEFICIT_KCAL,
  MAX_WEEKLY_RATE_FRACTION,
} from '@/domain/nutrition/safety';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal, formatWeeklyRate } from '@/lib/format';
import { nextStep, onboardingRoute, stepProgress } from '@/lib/onboarding-steps';

/** Pas du curseur : 50 g par semaine, assez fin sans donner une fausse précision. */
const RATE_STEP_KG = 0.05;
/** Le curseur descend au quart du plafond : un rythme très doux reste possible. */
const MIN_RATE_FRACTION_OF_MAX = 0.25;

/**
 * Écran 9 — rythme souhaité (perte de poids uniquement).
 *
 * Le curseur est **borné par le domaine** : la valeur maximale vient de
 * `getMaxWeeklyRateKg`, pas d'une constante d'écran. L'utilisateur ne peut donc
 * pas sélectionner un rythme dangereux, et le pourquoi lui est expliqué ici
 * plutôt qu'au moment du refus.
 */
export default function RateScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { draft, update } = useOnboarding();

  const currentWeightKg = draft.currentWeightKg;

  // Le rythme dépend du poids : sans biométrie, l'écran n'a pas de sens.
  if (currentWeightKg === undefined) {
    return <Redirect href="/(onboarding)/biometrics" />;
  }

  const maxWeeklyRateKg = round2(getMaxWeeklyRateKg(currentWeightKg));
  const minWeeklyRateKg = round2(maxWeeklyRateKg * MIN_RATE_FRACTION_OF_MAX);
  const recommendedRateKg = round2(getDefaultWeeklyRateKg(currentWeightKg));

  return (
    <RateSlider
      minWeeklyRateKg={minWeeklyRateKg}
      maxWeeklyRateKg={maxWeeklyRateKg}
      recommendedRateKg={recommendedRateKg}
      initialRateKg={draft.weeklyRateKg ?? recommendedRateKg}
      progress={stepProgress('rate', draft.goalType)}
      trackColor={theme.colors.primary}
      onSubmit={(weeklyRateKg) => {
        update({ weeklyRateKg });
        const next = nextStep('rate', draft.goalType);
        if (next) {
          router.push(onboardingRoute(next));
        }
      }}
    />
  );
}

interface RateSliderProps {
  minWeeklyRateKg: number;
  maxWeeklyRateKg: number;
  recommendedRateKg: number;
  initialRateKg: number;
  progress: { step: number; total: number };
  trackColor: string;
  onSubmit: (weeklyRateKg: number) => void;
}

function RateSlider(props: RateSliderProps) {
  const [rate, setRate] = useState(
    clamp(props.initialRateKg, props.minWeeklyRateKg, props.maxWeeklyRateKg),
  );

  const dailyDeficitKcal = Math.min(weeklyRateToDeficitKcal(rate), MAX_DAILY_DEFICIT_KCAL);
  const isRecommended = Math.abs(rate - props.recommendedRateKg) < RATE_STEP_KG / 2;

  return (
    <StepScreen
      testID="onboarding-rate"
      title="À quelle vitesse ?"
      subtitle="Plus vite n’est pas mieux : au-delà d’un certain rythme, c’est du muscle qui part."
      progress={props.progress}
      primaryLabel="Continuer"
      onPrimary={() => props.onSubmit(round2(rate))}
    >
      <View style={styles.readout}>
        <Text variant="numeric">{formatWeeklyRate(rate)}</Text>
        <Text variant="caption" tone="textMuted">
          soit environ {formatKcal(dailyDeficitKcal)} de moins par jour
          {isRecommended ? ' — le rythme recommandé' : ''}
        </Text>
      </View>

      <Slider
        testID="rate-slider"
        accessibilityLabel="Rythme de perte de poids hebdomadaire"
        minimumValue={props.minWeeklyRateKg}
        maximumValue={props.maxWeeklyRateKg}
        step={RATE_STEP_KG}
        value={rate}
        onValueChange={setRate}
        minimumTrackTintColor={props.trackColor}
      />

      <View style={styles.bounds}>
        <Text variant="caption" tone="textMuted">
          {formatWeeklyRate(props.minWeeklyRateKg)}
        </Text>
        <Text variant="caption" tone="textMuted">
          {formatWeeklyRate(props.maxWeeklyRateKg)}
        </Text>
      </View>

      <Callout
        testID="rate-cap-explanation"
        title="Pourquoi le curseur s’arrête là"
        body={
          `Le maximum est fixé à ${(MAX_WEEKLY_RATE_FRACTION * 100).toFixed(0)} % de ton poids ` +
          `par semaine, soit ${formatWeeklyRate(props.maxWeeklyRateKg)} dans ton cas. Au-delà, ` +
          `la littérature montre que la perte de masse musculaire s’accélère nettement, et le ` +
          `poids repris ensuite est presque toujours du gras. Le déficit quotidien est par ` +
          `ailleurs plafonné à ${formatKcal(MAX_DAILY_DEFICIT_KCAL)}.`
        }
      />
    </StepScreen>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const styles = StyleSheet.create({
  readout: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  bounds: { flexDirection: 'row', justifyContent: 'space-between' },
});
