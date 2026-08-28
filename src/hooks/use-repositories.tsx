import { createContext, useContext, type ReactNode } from 'react';

import type { Repositories } from '@/data/repositories/factory';

/**
 * Diffusion des repositories à l'arbre React.
 *
 * L'UI ne peut pas importer `@/data` (règle vérifiée par ESLint) : elle passe
 * par ce hook. Le contexte n'a **pas** de valeur par défaut pointant vers la
 * base de l'application — sans quoi importer ce module dans un test ouvrirait
 * SQLite. Le layout racine fournit toujours une valeur.
 */
const RepositoriesContext = createContext<Repositories | undefined>(undefined);

export interface RepositoriesProviderProps {
  value: Repositories;
  children: ReactNode;
}

export function RepositoriesProvider({ value, children }: RepositoriesProviderProps) {
  return <RepositoriesContext.Provider value={value}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);

  if (!repositories) {
    throw new Error(
      'useRepositories doit être utilisé sous un <RepositoriesProvider>. ' +
        'Le layout racine en fournit un une fois la base migrée.',
    );
  }

  return repositories;
}
