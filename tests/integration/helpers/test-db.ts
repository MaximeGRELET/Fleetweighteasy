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
  /**
   * Préfixe des identifiants générés. Deux bases simulant deux appareils en
   * ont besoin : de vrais UUID ne se croiseraient jamais, `id-1` si.
   */
  idPrefix?: string;
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
      return `${options.idPrefix ?? 'id'}-${idCounter}`;
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

/**
 * Accès au pilote sous-jacent, pour les rares vérifications qui doivent
 * observer la base **hors** de Drizzle : recensement des tables, comptage brut.
 * Un test qui affirme « toutes les tables sont vides » ne peut pas se fier au
 * schéma TypeScript, sinon il ne verrait jamais une table qu'on aurait oubliée.
 */
function client(database: TestDatabase): BetterSqlite3.Database {
  return (database.context.db as unknown as { $client: BetterSqlite3.Database }).$client;
}

/** Nom des tables présentes dans la base, hors tables internes de SQLite. */
export function listTableNames(database: TestDatabase): string[] {
  const rows = client(database)
    .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
    .all() as { name: string }[];

  return rows.map((row) => row.name).sort();
}

/**
 * Table interne de Drizzle : elle recense les migrations déjà appliquées et ne
 * fait donc pas partie des données applicatives. La vider ferait rejouer les
 * migrations sur des tables existantes, et l'app ne s'ouvrirait plus.
 */
export const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';

/** Nom des tables applicatives, hors table de migrations Drizzle. */
export function listAppTableNames(database: TestDatabase): string[] {
  return listTableNames(database).filter((name) => name !== DRIZZLE_MIGRATIONS_TABLE);
}

/** Nombre de lignes d'une table, nommée en dur par l'appelant. */
export function countRows(database: TestDatabase, table: string): number {
  const row = client(database).prepare(`select count(*) as total from "${table}"`).get() as {
    total: number;
  };

  return row.total;
}

/**
 * Nombre de lignes de chaque table applicative.
 *
 * Volontairement recensé depuis `sqlite_master` plutôt que depuis une liste
 * écrite à la main : une table ajoutée par une future migration apparaît ici
 * d'elle-même, et les tests qui s'appuient sur ce recensement échouent tant
 * qu'elle n'a pas été prise en compte.
 */
export function countRowsByTable(database: TestDatabase): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const name of listAppTableNames(database)) {
    counts[name] = countRows(database, name);
  }

  return counts;
}
