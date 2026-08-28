import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

/**
 * Base SQLite de l'application.
 *
 * Seul endroit du code qui ouvre une connexion. Les repositories reçoivent une
 * base en paramètre : ils ne connaissent ni `expo-sqlite`, ni ce fichier.
 */
export const DATABASE_NAME = 'fleetweighteasy.db';

const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

// WAL : lectures concurrentes pendant une écriture, indispensable pour que
// l'UI reste fluide pendant la saisie du journal.
sqlite.execSync('PRAGMA journal_mode = WAL;');
// SQLite désactive les clés étrangères par défaut, connexion par connexion.
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite);
export { sqlite };
