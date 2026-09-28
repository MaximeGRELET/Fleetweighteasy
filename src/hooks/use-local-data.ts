import { useCallback } from 'react';

import {
  type Backup,
  BackupError,
  type BackupErrorReason,
  type BackupSummary,
  parseBackup,
  serializeBackup,
  summarizeBackup,
} from '@/data/backup';
import { appInfo } from '@/lib/app-info';
import { pickBackupFileText, shareBackupFile } from '@/lib/backup-file';
import { resetInMemoryState } from '@/stores/reset';
import { todayIsoDate } from '@/stores/session';

import { useRepositories } from './use-repositories';

export type { Backup, BackupErrorReason, BackupSummary };

/** Issue du choix d'un fichier à restaurer. Rien n'est écrit à ce stade. */
export type PickedBackup =
  | { status: 'canceled' }
  | { status: 'ready'; backup: Backup; summary: BackupSummary }
  | { status: 'refused'; reason: BackupErrorReason };

export interface LocalDataController {
  /** Crée le fichier de sauvegarde et ouvre la feuille de partage. */
  exportData: () => Promise<void>;
  /** Fait choisir un fichier, le lit et le vérifie, sans rien écrire. */
  pickBackup: () => Promise<PickedBackup>;
  /**
   * Remplace toutes les données par celles de la sauvegarde. Lève une
   * `BackupError` si la base la refuse ; rien n'est alors modifié.
   */
  restore: (backup: Backup) => void;
  /** Efface toutes les données locales : droit à l'effacement (RGPD). */
  eraseAll: () => void;
}

/**
 * Données de l'utilisateur, prises comme un tout : sauvegarde, restauration,
 * effacement. L'app n'a pas de serveur ; c'est ici que l'utilisateur garde la
 * main sur ce qu'elle conserve de lui.
 */
export function useLocalData(): LocalDataController {
  const repositories = useRepositories();

  const exportData = useCallback(async () => {
    const backup = repositories.maintenance.createBackup();
    await shareBackupFile(backupFileName(), serializeBackup(backup));
  }, [repositories]);

  const pickBackup = useCallback(async (): Promise<PickedBackup> => {
    const text = await pickBackupFileText();

    if (text === undefined) {
      return { status: 'canceled' };
    }

    try {
      const backup = parseBackup(text);
      return { status: 'ready', backup, summary: summarizeBackup(backup) };
    } catch (error) {
      if (error instanceof BackupError) {
        return { status: 'refused', reason: error.reason };
      }
      throw error;
    }
  }, []);

  const restore = useCallback(
    (backup: Backup) => {
      repositories.maintenance.restoreBackup(backup);
      resetInMemoryState();
    },
    [repositories],
  );

  const eraseAll = useCallback(() => {
    repositories.maintenance.resetAllLocalData();
    resetInMemoryState();
  }, [repositories]);

  return { exportData, pickBackup, restore, eraseAll };
}

/** `fleetweighteasy-sauvegarde-2026-09-28.json` : daté, et reconnaissable dans un dossier. */
export function backupFileName(now: Date = new Date()): string {
  const slug = appInfo.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${slug}-sauvegarde-${todayIsoDate(now)}.json`;
}

export { BackupError };
