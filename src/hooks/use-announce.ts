import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Annonce un message aux lecteurs d'écran dès qu'il apparaît ou change.
 *
 * Une confirmation (« Séance enregistrée ») ou une erreur de saisie s'affiche
 * loin de l'endroit où se trouve le focus : sans annonce, qui n'y voit pas
 * appuie sur « Enregistrer » et n'apprend jamais si ça a marché.
 *
 * `announceForAccessibility` plutôt qu'une région vivante : elle vaut pour iOS
 * comme pour Android, alors que `accessibilityLiveRegion` n'existe que sur
 * Android — et les deux ensemble y feraient lire le message deux fois.
 */
export function useAnnounce(message: string | undefined): void {
  useEffect(() => {
    if (message) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}
