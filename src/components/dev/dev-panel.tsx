import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useDevDataReset } from '@/hooks/use-dev-reset';
import { useTheme } from '@/hooks/use-theme';

export interface DevPanelProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Panneau d'outillage de développement.
 *
 * Trois garde-fous se cumulent pour qu'il n'atteigne jamais un utilisateur :
 * ce composant ne rend rien hors `__DEV__`, ses points d'appel sont eux aussi
 * conditionnés par `__DEV__` — un littéral que le minifieur remplace par
 * `false` en build de production, ce qui supprime la branche — et le hook
 * d'effacement refuse de s'exécuter en dehors du développement.
 */
export function DevPanel(props: DevPanelProps) {
  if (!__DEV__) {
    return null;
  }

  return <DevPanelContent {...props} />;
}

/**
 * Contenu réel, séparé pour que `DevPanel` puisse sortir avant d'appeler le
 * moindre hook : hors développement, rien n'est monté ni lu en base.
 */
function DevPanelContent({ style }: DevPanelProps) {
  const theme = useTheme();
  const router = useRouter();
  const resetLocalData = useDevDataReset();
  // L'effacement est irréversible et le bouton vit sous le doigt pendant tout
  // le développement : un appui isolé ne suffit pas à perdre un jeu de test.
  const [armed, setArmed] = useState(false);

  function handleReset() {
    if (!armed) {
      setArmed(true);
      return;
    }

    setArmed(false);
    resetLocalData();
    // Retour par l'aiguillage racine plutôt que directement vers l'onboarding :
    // c'est exactement le chemin d'un premier lancement, et il reste juste si
    // le panneau est un jour posé sur un autre écran.
    router.replace('/');
  }

  return (
    <View
      testID="dev-panel"
      style={[
        styles.container,
        {
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceMuted,
        },
        style,
      ]}
    >
      <Text variant="caption" tone="textMuted">
        Outils de développement — absents des builds de production.
      </Text>

      <Button
        label={armed ? 'Confirmer l’effacement' : 'Réinitialiser les données (dev)'}
        variant={armed ? 'primary' : 'secondary'}
        onPress={handleReset}
        testID="dev-reset"
      />

      {armed ? (
        <>
          <Text variant="caption" tone="caution" testID="dev-reset-warning">
            Profil, consentement, journal, poids, séances et cache d’aliments seront effacés. L’app
            repartira sur l’onboarding.
          </Text>
          <Button
            label="Annuler"
            variant="quiet"
            onPress={() => setArmed(false)}
            testID="dev-reset-cancel"
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 14,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
