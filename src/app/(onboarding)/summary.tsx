import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StepScreen } from '@/components/onboarding/step-screen';
import { Callout, Text } from '@/components/ui';
import { ACTIVITY_FACTORS } from '@/domain/nutrition/energy';
import { tryBuildUserProfile } from '@/domain/profile/draft';
import { buildCaloriePlan } from '@/hooks/use-profile';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { formatGrams, formatKcal, formatWeeklyRate } from '@/lib/format';
import { HEALTH_DISCLAIMER } from '@/lib/legal';
import { explainCalorieTarget, explainMacros } from '@/lib/messages/safety';
import { nextStep, onboardingRoute, stepProgress } from '@/lib/onboarding-steps';

/**
 * Écran 10 — restitution.
 *
 * Le cœur pédagogique de l'onboarding : l'application montre ses chiffres, la
 * chaîne qui y mène, et **explique systématiquement** chaque garde-fou qui s'est
 * déclenché. Aucun ajustement n'est passé sous silence (PHASE_1 §5.3).
 */
export default function SummaryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { draft } = useOnboarding();

  const profile = tryBuildUserProfile(draft);

  if (!profile) {
    return <Redirect href="/(onboarding)/goal" />;
  }

  const { target, macros } = buildCaloriePlan(profile);
  const explanations = [...explainCalorieTarget(target), ...explainMacros(macros)];

  return (
    <StepScreen
      testID="onboarding-summary"
      title="Voici tes chiffres"
      subtitle="Et surtout, d’où ils sortent."
      progress={stepProgress('summary', draft.goalType)}
      primaryLabel="Continuer"
      onPrimary={() => {
        const next = nextStep('summary', draft.goalType);
        if (next) {
          router.push(onboardingRoute(next));
        }
      }}
      footerNote={HEALTH_DISCLAIMER}
    >
      <View
        style={[
          styles.hero,
          { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.lg },
        ]}
      >
        <Text variant="caption" tone="textMuted">
          Ton objectif quotidien
        </Text>
        <Text variant="numeric" testID="summary-target">
          {formatKcal(target.targetKcal)}
        </Text>
        {target.effectiveWeeklyRateKg > 0 ? (
          <Text variant="caption" tone="textMuted" testID="summary-rate">
            environ {formatWeeklyRate(target.effectiveWeeklyRateKg)}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text variant="heading">Comment on y arrive</Text>
        <StatRow
          label="Métabolisme de base"
          value={formatKcal(target.bmrKcal)}
          hint="Ce que ton corps dépense au repos, calculé avec l’équation de Mifflin-St Jeor."
        />
        <StatRow
          label="Dépense totale estimée"
          value={formatKcal(target.tdeeKcal)}
          hint={`Ton métabolisme multiplié par ${ACTIVITY_FACTORS[profile.activityLevel]}, le facteur correspondant à ton niveau d’activité.`}
        />
        <StatRow
          label={target.appliedDeficitKcal >= 0 ? 'Déficit appliqué' : 'Écart appliqué'}
          value={formatKcal(Math.abs(target.appliedDeficitKcal))}
          hint={
            target.appliedDeficitKcal >= 0
              ? 'Retiré de ta dépense pour créer la perte de poids.'
              : 'Ajouté à ta dépense pour rester au-dessus du seuil de sécurité.'
          }
        />
      </View>

      <View style={styles.section}>
        <Text variant="heading">Ta répartition</Text>
        <StatRow
          label="Protéines"
          value={formatGrams(macros.proteinG)}
          hint="Élevées volontairement : c’est ce qui préserve le muscle."
        />
        <StatRow
          label="Lipides"
          value={formatGrams(macros.fatG)}
          hint="Rôle hormonal et vitamines."
        />
        <StatRow
          label="Glucides"
          value={formatGrams(macros.carbsG)}
          hint="Le reste de l’énergie."
        />
      </View>

      {explanations.length > 0 ? (
        <View style={styles.section} testID="summary-explanations">
          <Text variant="heading">Ce qu’on a ajusté</Text>
          {explanations.map((explanation) => (
            <Callout
              key={explanation.id}
              testID={`explanation-${explanation.id}`}
              tone={explanation.tone}
              title={explanation.title}
              body={explanation.body}
            />
          ))}
        </View>
      ) : null}
    </StepScreen>
  );
}

function StatRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.statRow, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.statHeader}>
        <Text variant="body">{label}</Text>
        <Text variant="subheading">{value}</Text>
      </View>
      <Text variant="caption" tone="textMuted">
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 24, alignItems: 'center', gap: 4 },
  section: { gap: 12 },
  statRow: { gap: 2, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
