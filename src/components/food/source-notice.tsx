import { StyleSheet, View } from 'react-native';

import { Button, Callout } from '@/components/ui';
import type { SourceMessage } from '@/lib/messages/food-source';

export interface SourceNoticeProps {
  message: SourceMessage;
  /** Relance l'appel. Le bouton n'apparaît que si le message s'y prête. */
  onRetry?: () => void;
  /** Bascule sur la saisie manuelle — le repli de tous les chemins réseau. */
  onManualEntry?: () => void;
  testID?: string;
}

/**
 * Panneau d'échec d'une source distante.
 *
 * Règle de la phase : aucun écran ne reste vide ni bloqué sur un indicateur de
 * chargement sans réseau (PHASES_2_A_5 §4.7). Ce composant est la contrepartie
 * visible de cette règle — il explique ce qui s'est passé **et** propose au
 * moins une action. Un message sans issue ne vaudrait guère mieux qu'un écran
 * vide.
 */
export function SourceNotice({ message, onRetry, onManualEntry, testID }: SourceNoticeProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Callout title={message.title} body={message.body} tone="neutral" />

      <View style={styles.actions}>
        {message.offersRetry && onRetry ? (
          <Button label="Réessayer" variant="secondary" onPress={onRetry} testID="source-retry" />
        ) : null}
        {message.offersManualEntry && onManualEntry ? (
          <Button
            label="Saisir à la main"
            variant={message.offersRetry && onRetry ? 'quiet' : 'secondary'}
            onPress={onManualEntry}
            testID="source-manual-entry"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, width: '100%' },
  actions: { gap: 8 },
});
