import Slider from '@react-native-community/slider';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StepScreen } from '@/components/onboarding/step-screen';
import { Callout, Text } from '@/components/ui';
import { calculateCalorieTarget, type CalorieTargetResult } from '@/domain/nutrition/energy';
import {
  getDefaultWeeklyRateKg,
  getMaxWeeklyRateKg,
  MAX_DAILY_DEFICIT_KCAL,
  MAX_WEEKLY_RATE_FRACTION,
} from '@/domain/nutrition/safety';
import { tryBuildUserProfile, type ProfileDraft } from '@/domain/profile/draft';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal, formatWeeklyRate } from '@/lib/format';
import { explainRateSelection } from '@/lib/messages/safety';
import { nextStep, onboardingRoute, stepProgress } from '@/lib/onboarding-steps';

/** Pas du curseur : 50 g par semaine, assez fin sans donner une fausse précision. */
const RATE_STEP_KG = 0.05;
/** Le curseur descend au quart du plafond : un rythme très doux reste possible. */
const MIN_RATE_FRACTION_OF_MAX = 0.25;

/**
 * Écran 9 — rythme souhaité (perte de poids uniquement).
 *
 * Le curseur est **borné par le domaine** : sa valeur maximale vient de
 * `getMaxWeeklyRateKg`, pas d'une constante d'écran.
 *
 * Le plafond de rythme n'est cependant pas le seul garde-fou : le déficit
 * quotidien est écrêté séparément. Selon le poids, la moitié haute du curseur
 * peut donc pointer un rythme que le corps n'atteindra pas. L'écran projette
 * pour cela le résultat réel du domaine à chaque position, et affiche la perte
 * réellement atteignable **à côté** du rythme pointé.
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

  // Arrondi vers le bas : le curseur ne doit jamais pouvoir dépasser, même d'un
  // centième, le plafond calculé par le domaine.
  const maxWeeklyRateKg = floor2(getMaxWeeklyRateKg(currentWeightKg));
  const minWeeklyRateKg = floor2(maxWeeklyRateKg * MIN_RATE_FRACTION_OF_MAX);
  const recommendedRateKg = floor2(getDefaultWeeklyRateKg(currentWeightKg));

  return (
    <RateSlider
      draft={draft}
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
  draft: ProfileDraft;
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

  const requestedWeeklyRateKg = round2(rate);
  const projection = projectTarget(props.draft, requestedWeeklyRateKg);
  const explanations = projection
    ? explainRateSelection({ requestedWeeklyRateKg, result: projection })
    : [];

  const isRecommended = Math.abs(rate - props.recommendedRateKg) < RATE_STEP_KG / 2;

  return (
    <StepScreen
      testID="onboarding-rate"
      title="À quelle vitesse ?"
      subtitle="Plus vite n’est pas mieux : au-delà d’un certain rythme, c’est du muscle qui part."
      progress={props.progress}
      primaryLabel="Continuer"
      onPrimary={() => props.onSubmit(requestedWeeklyRateKg)}
    >
      <View style={styles.readout}>
        <Text variant="numeric" testID="rate-requested">
          {formatWeeklyRate(rate)}
        </Text>
        <Text variant="caption" tone="textMuted">
          rythme visé{isRecommended ? ' — le rythme recommandé' : ''}
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

      {projection ? (
        <View style={styles.projection}>
          {/*
            Affiché quoi qu'il arrive et distinctement du rythme pointé : c'est
            le seul chiffre sur lequel l'utilisateur peut compter.
          */}
          <Text variant="caption" tone="textMuted">
            Perte réellement atteignable
          </Text>
          <Text variant="subheading" testID="rate-effective">
            {formatWeeklyRate(projection.effectiveWeeklyRateKg)}
          </Text>
          <Text variant="caption" tone="textMuted" testID="rate-applied-deficit">
            soit {formatKcal(projection.appliedDeficitKcal)} de moins par jour, pour un objectif de{' '}
            {formatKcal(projection.targetKcal)}
          </Text>
        </View>
      ) : null}

      {explanations.map((explanation) => (
        <Callout
          key={explanation.id}
          testID={`explanation-${explanation.id}`}
          tone={explanation.tone}
          title={explanation.title}
          body={explanation.body}
        />
      ))}

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

/**
 * Projette le résultat réel pour la position courante du curseur.
 *
 * L'écran ne plafonne rien lui-même : il fait tourner le domaine sur le profil
 * en cours et affiche ce qu'il renvoie. Le seuil à partir duquel l'écrêtage
 * commence dépend du poids, et n'a donc pas à être connu ici.
 */
function projectTarget(draft: ProfileDraft, weeklyRateKg: number): CalorieTargetResult | undefined {
  const profile = tryBuildUserProfile({ ...draft, weeklyRateKg });
  return profile ? calculateCalorieTarget(profile) : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Arrondi au centième inférieur, avec une tolérance qui absorbe les artefacts
 * de virgule flottante : sans elle, un poids de 29 kg donnerait 0,28 au lieu de
 * 0,29 parce que 0.29 × 100 vaut 28,999999999999996.
 */
function floor2(value: number): number {
  return Math.floor(value * 100 + 1e-9) / 100;
}

const styles = StyleSheet.create({
  readout: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  bounds: { flexDirection: 'row', justifyContent: 'space-between' },
  projection: { gap: 4 },
});
