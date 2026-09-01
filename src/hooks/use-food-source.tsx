import { createContext, useContext, type ReactNode } from 'react';

import type { FoodCatalogSource } from '@/data/remote';

/**
 * Diffusion de la source alimentaire distante à l'arbre React.
 *
 * Même dispositif que `RepositoriesProvider`, et pour la même raison : l'UI ne
 * construit jamais sa source elle-même. Les tests injectent une doublure et
 * n'atteignent donc jamais le réseau (PHASES_2_A_5 §4.8), l'app injecte
 * Open Food Facts.
 *
 * Le contexte n'a **pas** de valeur par défaut : sans quoi un écran monté hors
 * provider partirait silencieusement sur le vrai réseau.
 */
const FoodSourceContext = createContext<FoodCatalogSource | undefined>(undefined);

export interface FoodSourceProviderProps {
  value: FoodCatalogSource;
  children: ReactNode;
}

export function FoodSourceProvider({ value, children }: FoodSourceProviderProps) {
  return <FoodSourceContext.Provider value={value}>{children}</FoodSourceContext.Provider>;
}

export function useFoodSource(): FoodCatalogSource {
  const source = useContext(FoodSourceContext);

  if (!source) {
    throw new Error(
      'useFoodSource doit être utilisé sous un <FoodSourceProvider>. ' +
        'Le layout racine en fournit un.',
    );
  }

  return source;
}
