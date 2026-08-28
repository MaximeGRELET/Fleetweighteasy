import type { AppDatabase } from '@/data/db/types';

/**
 * Dépendances communes à tous les repositories.
 *
 * Injectées plutôt qu'importées : les tests fournissent une base en mémoire,
 * une horloge figée et des identifiants déterministes ; l'app fournit SQLite,
 * l'horloge système et des UUID. Aucun repository ne connaît `expo-*`.
 */
export interface RepositoryContext {
  db: AppDatabase;
  generateId: () => string;
  now: () => Date;
}
