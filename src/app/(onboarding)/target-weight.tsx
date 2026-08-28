import { useRouter } from 'expo-router';
import { useState } from 'react';

import { StepScreen } from '@/components/onboarding/step-screen';
import { Callout, Text, TextField } from '@/components/ui';
import { calculateBmi, classifyBmi, minimumHealthyWeightKg } from '@/domain/profile/bmi';
import { targetWeightStepSchema } from '@/domain/profile/validation';
import { useOnboarding } from '@/hooks/use-onboarding';
import { formatKg } from '@/lib/format';
import { nextStep, onboardingRoute, stepProgress } from '@/lib/onboarding-steps';

/**
 * Écran 5 — poids cible (optionnel, sauté au maintien).
 *
 * Le contrôle d'IMC est fait **en direct** avec les fonctions du domaine, jamais
 * avec un seuil réécrit ici. Un objectif trop bas n'est pas bloqué : il est
 * signalé avec tact (PHASE_1 §5.4).
 */
export default function TargetWeightScreen() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const [text, setText] = useState(draft.targetWeightKg?.toString() ?? '');

  const parsedValue = parseOptionalNumber(text);
  const validation = targetWeightStepSchema.safeParse({ targetWeightKg: parsedValue });
  const formatError = validation.success ? undefined : validation.error.issues[0]?.message;

  const leadsToUnderweight =
    draft.heightCm !== undefined &&
    validation.success &&
    validation.data.targetWeightKg !== undefined &&
    classifyBmi(
      calculateBmi({ weightKg: validation.data.targetWeightKg, heightCm: draft.heightCm }),
    ) === 'underweight';

  const goNext = (targetWeightKg: number | undefined) => {
    update(targetWeightKg === undefined ? { targetWeightKg: undefined } : { targetWeightKg });
    const next = nextStep('target-weight', draft.goalType);

    if (next) {
      router.push(onboardingRoute(next));
    }
  };

  return (
    <StepScreen
      testID="onboarding-target-weight"
      title="As-tu un poids en tête ?"
      subtitle="C’est facultatif. L’objectif calorique se calcule très bien sans."
      progress={stepProgress('target-weight', draft.goalType)}
      primaryLabel="Continuer"
      primaryDisabled={!validation.success}
      onPrimary={() => validation.success && goNext(validation.data.targetWeightKg)}
      secondaryLabel="Je préfère ne pas en fixer"
      onSecondary={() => goNext(undefined)}
    >
      <TextField
        testID="target-weight-field"
        label="Poids cible"
        suffix="kg"
        keyboardType="numeric"
        value={text}
        onChangeText={setText}
        placeholder="Optionnel"
        {...(formatError ? { error: formatError } : {})}
      />

      {leadsToUnderweight && draft.heightCm !== undefined ? (
        <Callout
          testID="underweight-warning"
          tone="caution"
          title="Ce poids est très bas pour ta taille"
          body={
            `Il correspond à une corpulence sous le seuil considéré comme sain. On ne va pas ` +
            `t’encourager dans cette direction. Pour ta taille, ${formatKg(
              minimumHealthyWeightKg(draft.heightCm),
            )} est le bas de la fourchette saine. Si tu tiens à cet objectif, parles-en à un ` +
            `médecin ou à un diététicien.`
          }
        />
      ) : null}

      <Text variant="caption" tone="textMuted">
        Le poids cible sert de repère de progression. Il n’entre pas dans le calcul de ton objectif
        calorique, qui dépend de ton poids actuel et de ton rythme.
      </Text>
    </StepScreen>
  );
}

function parseOptionalNumber(text: string): number | undefined {
  const normalized = text.replace(',', '.').trim();

  if (normalized.length === 0) {
    return undefined;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : Number.NaN;
}
