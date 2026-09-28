import { getTableColumns } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  consent,
  foodItem,
  foodLogEntry,
  goalChangeEvent,
  meal,
  profile,
  weightEntry,
  workoutLogEntry,
} from './db/schema';
import { markDirty } from './db/sync-meta';
import type { AppDatabase } from './db/types';
import { deleteAllLocalRows } from './reset';
import {
  type FoodItemRow,
  type FoodLogEntryRow,
  type GoalChangeEventRow,
  type MealRow,
  type ProfileRow,
  toFoodItem,
  toFoodLogEntry,
  toGoalChangeEvent,
  toMeal,
  toUserProfile,
  toWeightEntry,
  toWorkoutLogEntry,
  type WeightEntryRow,
  type WorkoutLogEntryRow,
} from './types';

/**
 * Sauvegarde par fichier (ticket #21).
 *
 * L'app n'a pas de serveur (AVANCEMENT.md, « Décisions — Phase 9 ») : ce
 * fichier est la seule façon de retrouver ses données sur un autre téléphone,
 * et c'est aussi l'export exigé par le RGPD.
 *
 * Le fichier contient les lignes de chaque table applicative, telles que
 * Drizzle les lit : complet par construction, lisible dans un éditeur de texte.
 * Les tables techniques (`sync_meta`, `sync_state`) n'en font pas partie :
 * elles décrivent l'état de l'appareil, pas les données de l'utilisateur.
 *
 * La restauration **remplace** tout. Une fusion créerait des doublons dès que
 * les deux côtés ont une pesée le même jour ou le même profil modifié, sans
 * règle évidente pour trancher. Tout est vérifié avant la moindre écriture, et
 * l'écriture se fait en une transaction : un fichier refusé ne change rien.
 */

/** Signature du fichier : distingue une sauvegarde de n'importe quel JSON. */
export const BACKUP_FORMAT = 'fleetweighteasy-backup';

/**
 * Version du format. À incrémenter dès qu'une migration modifie une table
 * sauvegardée, en ajoutant la conversion des versions précédentes : un fichier
 * exporté aujourd'hui doit rester restaurable par les versions suivantes.
 */
export const BACKUP_VERSION = 1;

/**
 * Tables sauvegardées, dans l'ordre d'insertion à la restauration : les parents
 * avant les enfants (`food_log_entry` référence `food_item` et `meal`).
 */
const BACKED_UP_TABLES = {
  profile,
  consent,
  goal_change_event: goalChangeEvent,
  food_item: foodItem,
  meal,
  food_log_entry: foodLogEntry,
  weight_entry: weightEntry,
  workout_log_entry: workoutLogEntry,
} satisfies Record<string, SQLiteTable>;

export type BackedUpTable = keyof typeof BACKED_UP_TABLES;

export const BACKED_UP_TABLE_NAMES = Object.keys(BACKED_UP_TABLES) as BackedUpTable[];

type BackupRow = Record<string, unknown>;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  /** Horodatage ISO 8601 de l'export. */
  exportedAt: string;
  tables: Record<BackedUpTable, BackupRow[]>;
}

export type BackupErrorReason =
  /** Pas du JSON : fichier tronqué, ou d'un autre type. */
  | 'unreadable'
  /** Du JSON, mais pas une sauvegarde de l'app. */
  | 'not_a_backup'
  /** Une sauvegarde d'une version que cette version de l'app ne connaît pas. */
  | 'unsupported_version'
  /** Une sauvegarde dont le contenu est incohérent : rien n'a été écrit. */
  | 'invalid_content';

export class BackupError extends Error {
  constructor(
    readonly reason: BackupErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

// --- Export ----------------------------------------------------------------

export function createBackup(db: AppDatabase, at: Date): Backup {
  const tables = {} as Record<BackedUpTable, BackupRow[]>;

  for (const name of BACKED_UP_TABLE_NAMES) {
    tables[name] = db.select().from(BACKED_UP_TABLES[name]).all();
  }

  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: at.toISOString(), tables };
}

/** Indenté : le fichier doit rester lisible par un humain (portabilité RGPD). */
export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

// --- Lecture et vérification -----------------------------------------------

/**
 * Lit et vérifie un fichier de sauvegarde, sans rien écrire.
 *
 * Tout ce qui peut l'être est vérifié ici : structure, version, type de chaque
 * colonne, contenu des colonnes JSON. La restauration n'a plus alors que les
 * contraintes SQL (clés, unicité) à découvrir, et elle les découvre dans sa
 * transaction.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('unreadable', 'Le fichier n’est pas du JSON valide.');
  }

  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    throw new BackupError('not_a_backup', 'Le fichier n’est pas une sauvegarde de l’application.');
  }

  if (raw.version !== BACKUP_VERSION) {
    throw new BackupError(
      'unsupported_version',
      `Version de sauvegarde non prise en charge : ${String(raw.version)}.`,
    );
  }

  if (typeof raw.exportedAt !== 'string' || !isRecord(raw.tables)) {
    throw new BackupError('invalid_content', 'En-tête de sauvegarde incomplet.');
  }

  const rawTables = raw.tables;
  const unknownTables = Object.keys(rawTables).filter(
    (name) => !(BACKED_UP_TABLE_NAMES as string[]).includes(name),
  );
  if (unknownTables.length > 0) {
    throw new BackupError('invalid_content', `Tables inconnues : ${unknownTables.join(', ')}.`);
  }

  const tables = {} as Record<BackedUpTable, BackupRow[]>;

  for (const name of BACKED_UP_TABLE_NAMES) {
    const rows = rawTables[name] ?? [];

    if (!Array.isArray(rows)) {
      throw new BackupError('invalid_content', `La table ${name} n’est pas une liste.`);
    }

    tables[name] = rows.map((row, index) => checkRow(name, row, index));
  }

  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: raw.exportedAt,
    tables,
  };
  checkJsonColumns(backup);

  return backup;
}

/**
 * Vérifie une ligne contre les colonnes déclarées de sa table.
 *
 * SQLite accepterait un texte dans une colonne `real` : c'est ici, et pas à
 * l'insertion, qu'un poids `"abc"` doit être refusé. Une colonne inconnue est
 * refusée elle aussi : elle viendrait d'une version plus récente de l'app, et
 * l'ignorer perdrait une donnée sans le dire.
 */
function checkRow(name: BackedUpTable, row: unknown, index: number): BackupRow {
  const where = `${name}[${index}]`;

  if (!isRecord(row)) {
    throw new BackupError('invalid_content', `${where} n’est pas un objet.`);
  }

  const columns = getTableColumns(BACKED_UP_TABLES[name]);

  const unknownKeys = Object.keys(row).filter((key) => !(key in columns));
  if (unknownKeys.length > 0) {
    throw new BackupError(
      'invalid_content',
      `${where} : colonnes inconnues ${unknownKeys.join(', ')}.`,
    );
  }

  for (const [key, column] of Object.entries(columns)) {
    const value = row[key];

    if (value === undefined || value === null) {
      if (column.notNull && !column.hasDefault) {
        throw new BackupError('invalid_content', `${where}.${key} est obligatoire.`);
      }
      continue;
    }

    if (!hasColumnType(value, column.dataType, column.enumValues)) {
      throw new BackupError('invalid_content', `${where}.${key} a une valeur invalide.`);
    }
  }

  return row;
}

function hasColumnType(value: unknown, dataType: string, enumValues?: readonly string[]): boolean {
  switch (dataType) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return (
        typeof value === 'string' &&
        (enumValues === undefined || enumValues.length === 0 || enumValues.includes(value))
      );
    default:
      // Aucune table sauvegardée n'a d'autre type aujourd'hui. Une colonne d'un
      // type nouveau doit être prise en charge ici, pas acceptée à l'aveugle.
      return false;
  }
}

/**
 * Fait passer chaque ligne par les mappers de lecture de l'app.
 *
 * Ce sont eux qui valident les colonnes JSON (allergies, portions, contenu des
 * séances…). Une sauvegarde qu'ils refuseraient au premier affichage doit être
 * refusée maintenant, pas après avoir remplacé des données saines.
 */
function checkJsonColumns(backup: Backup): void {
  const { tables } = backup;

  try {
    tables.profile.forEach((row) => toUserProfile(row as ProfileRow));
    tables.goal_change_event.forEach((row) => toGoalChangeEvent(row as GoalChangeEventRow));
    tables.food_item.forEach((row) => toFoodItem(row as FoodItemRow));
    tables.meal.forEach((row) => toMeal(row as MealRow));
    tables.food_log_entry.forEach((row) => toFoodLogEntry(row as FoodLogEntryRow));
    tables.weight_entry.forEach((row) => toWeightEntry(row as WeightEntryRow));
    tables.workout_log_entry.forEach((row) => toWorkoutLogEntry(row as WorkoutLogEntryRow));
  } catch (error) {
    throw new BackupError(
      'invalid_content',
      error instanceof Error ? error.message : 'Contenu de sauvegarde invalide.',
    );
  }
}

// --- Restauration ----------------------------------------------------------

export type BackupSummary = { exportedAt: string } & Record<BackedUpTable, number>;

/** Ce que contient une sauvegarde, pour le montrer avant de remplacer quoi que ce soit. */
export function summarizeBackup(backup: Backup): BackupSummary {
  const summary = { exportedAt: backup.exportedAt } as BackupSummary;

  for (const name of BACKED_UP_TABLE_NAMES) {
    summary[name] = backup.tables[name].length;
  }

  return summary;
}

/**
 * Remplace toutes les données locales par celles de la sauvegarde.
 *
 * Une seule transaction : si une contrainte SQL refuse une ligne (identifiant
 * en double, deux pesées le même jour…), rien n'est effacé ni écrit.
 *
 * Chaque ligne restaurée est marquée à synchroniser, comme toute écriture de
 * l'app : `sync_meta` reste ainsi fidèle aux données, au cas où une synchro
 * verrait le jour.
 */
export function restoreBackup(db: AppDatabase, backup: Backup, at: Date): void {
  try {
    db.transaction((tx) => {
      deleteAllLocalRows(tx);

      for (const name of BACKED_UP_TABLE_NAMES) {
        const table = BACKED_UP_TABLES[name];

        for (const row of backup.tables[name]) {
          tx.insert(table)
            .values(row as typeof table.$inferInsert)
            .run();
          markDirty(tx, name, String(row.id), at);
        }
      }
    });
  } catch (error) {
    throw new BackupError(
      'invalid_content',
      error instanceof Error ? error.message : 'La sauvegarde n’a pas pu être restaurée.',
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
