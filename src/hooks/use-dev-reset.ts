import { useCallback } from 'react';

import { resetInMemoryState } from '@/stores/reset';

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
    resetInMemoryState();
  }, [repositories]);
}
