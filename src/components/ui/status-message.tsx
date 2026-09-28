import { useAnnounce } from '@/hooks/use-announce';

import { Text } from './text';

export interface StatusMessageProps {
  /** Texte affiché, et annoncé aux lecteurs d'écran dès qu'il apparaît. */
  message: string;
  /** `primary` pour une confirmation, `caution` pour une saisie à reprendre. */
  tone: 'primary' | 'caution';
  testID?: string;
}

/**
 * Retour d'une action : confirmation ou erreur de saisie.
 *
 * Il s'affiche là où l'œil l'attend, rarement là où se trouve le focus du
 * lecteur d'écran — d'où l'annonce, sans laquelle l'action semblerait sans
 * effet.
 */
export function StatusMessage({ message, tone, testID }: StatusMessageProps) {
  useAnnounce(message);

  return (
    <Text variant="caption" tone={tone} testID={testID}>
      {message}
    </Text>
  );
}
