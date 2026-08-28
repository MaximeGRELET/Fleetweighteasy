import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { db } from './client';
import migrations from './migrations/migrations';

/**
 * Applique les migrations au démarrage.
 *
 * L'app doit afficher un écran d'attente tant que `success` est faux : ouvrir
 * l'interface sur une base non migrée provoquerait des erreurs SQL en cascade.
 */
export function useDatabaseMigrations(): { success: boolean; error?: Error } {
  const { success, error } = useMigrations(db, migrations);
  return error ? { success, error } : { success };
}
