import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/**
 * Type de base de données manipulé par les repositories.
 *
 * Volontairement agnostique du pilote : l'app tourne sur `expo-sqlite`, les
 * tests d'intégration sur `better-sqlite3` en mémoire. Les deux sont des
 * bases SQLite synchrones et satisfont ce contrat, tout comme une transaction
 * Drizzle — ce qui permet de passer indifféremment `db` ou `tx` aux helpers.
 */
export type AppDatabase = BaseSQLiteDatabase<'sync', unknown>;
