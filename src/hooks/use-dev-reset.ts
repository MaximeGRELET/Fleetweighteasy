import { useCallback } from 'react';

import { useOnboardingStore } from '@/stores/onboarding';
import { useSessionStore } from '@/stores/session';

import { useRepositories } from './use-repositories';

/**
 * Remise à zéro complète de l'app — **outillage de développement uniquement**.
 *
 * Tester l'onboarding sur un appareil demandait jusqu'ici de désinstaller
 * l'app entre deux essais. Ce hook fait la même chose sans quitter l'app :
 * il efface la base, puis remet l'état mémoire dans sa position de premier
 * lancement.
 *
 * Le garde `__DEV__` est dans la fonction rendue, pas dans le corps du hook :
 * une exception levée pendant le rendu ferait tomber tout l'écran, alors qu'ici
 * elle ne peut se produire qu'au moment d'un appui — dans un build où le bouton
 * n'existe de toute façon pas.
 */
export function useDevDataReset(): () => void {
  const repositories = useRepositories();

  return useCallback(() => {
    if (!__DEV__) {
      throw new Error(
        'useDevDataReset est réservé au développement : il efface toutes les données locales.',
      );
    }

    repositories.maintenance.resetAllLocalData();

    // L'état mémoire doit repartir de zéro lui aussi, sinon un brouillon
    // d'onboarding abandonné ou un jour sélectionné survivrait à l'effacement.
    useOnboardingStore.getState().reset();

    const session = useSessionStore.getState();
    session.reset();
    // `reset()` remet `databaseReady` à faux, ce qui serait un mensonge : les
    // migrations restent appliquées, seules les lignes ont disparu.
    session.setDatabaseReady(true);
    // Après `reset()`, la révision vaut 0 — soit parfois sa valeur d'avant.
    // L'incrémenter garantit un changement, donc une relecture du profil par
    // les écrans abonnés, et donc la redirection vers l'onboarding.
    session.bumpProfileRevision();
  }, [repositories]);
}
