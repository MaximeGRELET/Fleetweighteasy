import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StepScreen } from '@/components/onboarding/step-screen';
import { Checkbox, Text } from '@/components/ui';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { CONSENT_POINTS } from '@/lib/messages/safety';
import { onboardingRoute } from '@/lib/onboarding-steps';

/**
 * Écran 2 — consentement aux données de santé (RGPD).
 *
 * **Bloquant** : rien ne se passe tant que la case n'est pas cochée, et aucune
 * donnée biométrique n'est demandée avant. La case n'est jamais pré-cochée.
 */
export default function ConsentScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { grantConsent } = useOnboarding();
  const [accepted, setAccepted] = useState(false);

  return (
    <StepScreen
      testID="onboarding-consent"
      title="Tes données de santé"
      subtitle="Avant de te demander quoi que ce soit, voici ce que l’application collecte et pourquoi."
      primaryLabel="J’accepte et je continue"
      primaryDisabled={!accepted}
      onPrimary={() => {
        grantConsent();
        router.push(onboardingRoute('goal'));
      }}
    >
      <View style={styles.points}>
        {CONSENT_POINTS.map((point) => (
          <View key={point} style={styles.point}>
            <Text variant="body" tone="primary">
              •
            </Text>
            <Text variant="body" tone="textMuted" style={styles.pointText}>
              {point}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.consentBox,
          { borderColor: theme.colors.border, borderRadius: theme.radius.md },
        ]}
      >
        <Checkbox
          testID="consent-checkbox"
          checked={accepted}
          onToggle={() => setAccepted((previous) => !previous)}
          label="Je consens à ce que ces données de santé soient collectées et traitées sur cet appareil pour personnaliser mes calculs et mes conseils."
        />
      </View>

      <Text variant="caption" tone="textMuted">
        Tu peux retirer ton consentement et effacer toutes tes données à tout moment. La politique
        de confidentialité complète est disponible dans les réglages.
      </Text>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  points: { gap: 10 },
  point: { flexDirection: 'row', gap: 10 },
  pointText: { flex: 1 },
  consentBox: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
});
