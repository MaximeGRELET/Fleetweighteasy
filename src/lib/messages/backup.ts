import type { BackupErrorReason } from '@/data/backup';

import type { Explanation } from './safety';

/**
 * Textes de la sauvegarde par fichier.
 *
 * Un refus d'import doit dire deux choses : pourquoi, et que rien n'a changé.
 * C'est la seconde qui rassure — on vient de proposer de remplacer toutes les
 * données de quelqu'un.
 */

const NOTHING_CHANGED = 'Tes données actuelles n’ont pas été modifiées.';

const IMPORT_ERRORS: Record<BackupErrorReason, Omit<Explanation, 'id'>> = {
  unreadable: {
    tone: 'caution',
    title: 'Ce fichier est illisible',
    body: `Il n’est pas au bon format, ou il a été abîmé en route. ${NOTHING_CHANGED}`,
  },
  not_a_backup: {
    tone: 'caution',
    title: 'Ce n’est pas une sauvegarde de l’application',
    body: `Choisis le fichier créé avec « Exporter mes données ». ${NOTHING_CHANGED}`,
  },
  unsupported_version: {
    tone: 'caution',
    title: 'Sauvegarde trop récente',
    body:
      'Elle a été créée par une version plus récente de l’application. Mets l’application à ' +
      `jour, puis réessaie. ${NOTHING_CHANGED}`,
  },
  invalid_content: {
    tone: 'caution',
    title: 'Cette sauvegarde est incomplète ou abîmée',
    body: `Elle ne peut pas être restaurée sans risque de perdre des données. ${NOTHING_CHANGED}`,
  },
};

export function explainImportError(reason: BackupErrorReason): Explanation {
  return { id: `backup_${reason}`, ...IMPORT_ERRORS[reason] };
}

export const EXPORT_FAILED: Explanation = {
  id: 'backup_export_failed',
  tone: 'caution',
  title: 'L’export n’a pas abouti',
  body: 'Le fichier n’a pas pu être créé ou partagé. Tes données sont intactes ; tu peux réessayer.',
};

/** Rappel affiché à côté du bouton d'export : le fichier n'est protégé par rien. */
export const BACKUP_PRIVACY_NOTE =
  'Ce fichier contient toutes tes données, dont des données de santé. Il n’est pas chiffré : ' +
  'range-le dans un endroit qui n’est accessible qu’à toi.';
