import { useRouter } from 'expo-router';

import { DevPanel } from '@/components/dev/dev-panel';
import { StepScreen } from '@/components/onboarding/step-screen';
import { Button, Text } from '@/components/ui';
import { appInfo } from '@/lib/app-info';
import { HEALTH_DISCLAIMER } from '@/lib/legal';

/** Écran 1 — accueil : la promesse en une phrase, rien de plus. */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <StepScreen
      testID="onboarding-welcome"
      title={`Bienvenue sur ${appInfo.name}`}
      subtitle="Une application qui ne se contente pas de compter : elle t’explique comment atteindre ton objectif."
      primaryLabel="Commencer"
      onPrimary={() => router.push('/(onboarding)/consent')}
      footerNote={HEALTH_DISCLAIMER}
    >
      <Text variant="body" tone="textMuted">
        Quelques questions suffisent pour calculer tes besoins réels et adapter les conseils, les
        recettes et l’entraînement à ta situation. Compte deux à trois minutes.
      </Text>
      <Text variant="body" tone="textMuted">
        Tes chiffres viennent de formules scientifiques référencées, pas d’estimations au doigt
        mouillé — et tu pourras toujours voir d’où ils sortent.
      </Text>

      {/* Sans serveur, une sauvegarde est la seule façon de retrouver ses
          données sur un téléphone neuf : la restaurer ne doit pas exiger de
          refaire tout le parcours d'abord. */}
      <Button
        label="J’ai une sauvegarde à restaurer"
        variant="quiet"
        onPress={() => router.push('/data')}
        testID="onboarding-restore"
      />

      {/* Aussi ici, et pas seulement sur l'écran du jour : le consentement est
          persisté dès le deuxième écran, donc rejouer le parcours depuis le
          début suppose de pouvoir l'effacer sans avoir à le terminer. */}
      {__DEV__ ? <DevPanel /> : null}
    </StepScreen>
  );
}
