import { useCallback, useMemo } from 'react';

import {
  applyAdaptiveEvaluation,
  evaluateAdaptiveTarget,
  type AdaptiveEvaluation,
} from '@/domain/progress/adaptive';
import { buildWeightTrend, resolveReferenceWeightKg } from '@/domain/progress/trend';
import type { WeightEntry } from '@/domain/progress/types';
import { useSessionStore } from '@/stores/session';

import { useRepositories } from './use-repositories';

/**
 * Suivi du poids : lecture de l'historique et enregistrement d'une pesée.
 *
 * Entièrement local, donc disponible hors ligne comme le journal. Le hook
 * orchestre — il lit, appelle le domaine, écrit — mais ne calcule rien
 * lui-même : ni la moyenne mobile, ni le seuil de réalignement, ni l'objectif.
 */

/** Historique complet, par date croissante. */
export function useWeightHistory(): WeightEntry[] {
  const repositories = useRepositories();
  const weightRevision = useSessionStore((state) => state.weightRevision);

  return useMemo(
    () => repositories.weight.getHistory(),
    // `weightRevision` provoque la relecture après chaque écriture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repositories, weightRevision],
  );
}

export interface RecordWeightInput {
  /** Date civile de la pesée. Une seule par jour : repeser corrige la valeur. */
  date: string;
  weightKg: number;
  note?: string;
}

export interface RecordWeightResult {
  entry: WeightEntry;
  /**
   * Conséquence de cette pesée sur l'objectif calorique.
   *
   * Absente tant qu'aucun profil n'existe. C'est l'écran qui la met en mots via
   * `explainAdaptiveAdjustment` — le hook ne rédige pas.
   */
  adaptive?: AdaptiveEvaluation;
}

export interface WeightTracker {
  history: WeightEntry[];
  /** Pesée déjà saisie pour cette date, s'il y en a une. */
  entryForDate: (date: string) => WeightEntry | undefined;
  recordWeight: (input: RecordWeightInput) => RecordWeightResult;
  removeEntry: (entryId: string) => void;
}

export function useWeightTracker(): WeightTracker {
  const repositories = useRepositories();
  const history = useWeightHistory();
  const bumpWeight = useSessionStore((state) => state.bumpWeightRevision);
  const bumpProfile = useSessionStore((state) => state.bumpProfileRevision);

  const recordWeight = useCallback(
    (input: RecordWeightInput): RecordWeightResult => {
      const entry = repositories.weight.upsertForDate(input);
      bumpWeight();

      const profile = repositories.profile.get();

      if (!profile) {
        return { entry };
      }

      // La tendance est relue en base plutôt que dérivée de `history` : ce
      // dernier date du rendu précédent et ignorerait la pesée qu'on vient
      // d'écrire.
      const referenceWeightKg = resolveReferenceWeightKg(
        buildWeightTrend(repositories.weight.getHistory()),
      );

      if (referenceWeightKg === undefined) {
        return { entry };
      }

      const adaptive = evaluateAdaptiveTarget({ profile, referenceWeightKg });

      // Le profil suit le poids lissé dès qu'il a bougé d'un demi-kilo, que
      // l'utilisateur soit prévenu ou non : c'est ce qui garde l'objectif juste
      // entre deux notifications. La même écriture déplace la base d'annonce
      // quand une notification part — `applyAdaptiveEvaluation` s'en charge,
      // pour qu'aucun appelant ne puisse réaligner en oubliant la base.
      if (adaptive.shouldUpdateProfile) {
        repositories.profile.save(applyAdaptiveEvaluation(profile, adaptive));
        bumpProfile();
      }

      return { entry, adaptive };
    },
    [repositories, bumpWeight, bumpProfile],
  );

  const removeEntry = useCallback(
    (entryId: string) => {
      repositories.weight.remove(entryId);
      bumpWeight();
    },
    [repositories, bumpWeight],
  );

  const entryForDate = useCallback(
    (date: string) => repositories.weight.getByDate(date),
    // La relecture doit suivre les écritures, comme `useWeightHistory`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repositories, history],
  );

  return { history, entryForDate, recordWeight, removeEntry };
}
