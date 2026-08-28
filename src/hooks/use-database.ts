import { useEffect } from 'react';

import { useDatabaseMigrations } from '@/data/db/migrator';
import { useSessionStore } from '@/stores/session';

export interface DatabaseStatus {
  /** Vrai une fois les migrations appliquées : la base est utilisable. */
  ready: boolean;
  error?: Error;
}

/**
 * Prépare la base locale au démarrage.
 *
 * Seul point de contact entre l'UI et la couche data pour la persistance :
 * `src/app/**` ne peut pas importer `@/data` directement (règle vérifiée par
 * ESLint), c'est ce hook qui fait le pont.
 */
export function useDatabase(): DatabaseStatus {
  const { success, error } = useDatabaseMigrations();
  const setDatabaseReady = useSessionStore((state) => state.setDatabaseReady);

  useEffect(() => {
    setDatabaseReady(success);
  }, [success, setDatabaseReady]);

  return error ? { ready: success, error } : { ready: success };
}
