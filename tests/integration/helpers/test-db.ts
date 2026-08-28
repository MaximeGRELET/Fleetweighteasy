import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import type { AppDatabase } from '@/data/db/types';
import type { RepositoryContext } from '@/data/repositories/context';

/**
 * Base de test : SQLite en mémoire, migrée avec **les mêmes fichiers** que
 * l'application. C'est ce qui fait de ces tests une vraie vérification des
 * migrations et pas seulement des repositories.
 *
 * L'horloge et le générateur d'identifiants sont injectés et déterministes :
 * aucun test ne dépend de l'heure réelle.
 */
export const MIGRATIONS_FOLDER = 'src/data/db/migrations';

export interface TestDatabase {
  context: RepositoryContext;
  db: AppDatabase;
  /** Avance l'horloge injectée. */
  advanceMinutes: (minutes: number) => void;
  /** Fige l'horloge sur un instant précis. */
  setNow: (at: Date) => void;
  currentNow: () => Date;
  close: () => void;
}

export interface TestDatabaseOptions {
  /** Instant initial de l'horloge figée. */
  startAt?: Date;
}

const DEFAULT_START = new Date('2026-03-15T08:00:00.000Z');

export function createTestDatabase(options: TestDatabaseOptions = {}): TestDatabase {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  let clock = options.startAt ?? DEFAULT_START;
  let idCounter = 0;

  const context: RepositoryContext = {
    db,
    generateId: () => {
      idCounter += 1;
      return `id-${idCounter}`;
    },
    now: () => clock,
  };

  return {
    context,
    db,
    advanceMinutes: (minutes) => {
      clock = new Date(clock.getTime() + minutes * 60_000);
    },
    setNow: (at) => {
      clock = at;
    },
    currentNow: () => clock,
    close: () => sqlite.close(),
  };
}

/** Nom des tables présentes dans la base, hors tables internes de SQLite. */
export function listTableNames(database: TestDatabase): string[] {
  const rows = (database.context.db as unknown as { $client: BetterSqlite3.Database }).$client
    .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
    .all() as { name: string }[];

  return rows.map((row) => row.name).sort();
}
