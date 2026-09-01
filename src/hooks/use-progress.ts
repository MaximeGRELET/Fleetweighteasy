import { useMemo } from 'react';

import { getMaxWeeklyRateKg } from '@/domain/nutrition/safety';
import { buildProgressSummary, type ProgressSummary } from '@/domain/progress/summary';
import type { ProgressPeriod } from '@/domain/progress/types';
import { todayIsoDate } from '@/stores/session';

import { useCaloriePlan, useStoredProfile } from './use-profile';
import { useWeightHistory } from './use-weight';

/**
 * Progression du poids, prête à afficher.
 *
 * Assemble trois sources — l'historique des pesées, le rythme visé recalculé
 * depuis le profil, le plafond de sécurité — et confie leur combinaison au
 * domaine. Comme pour `useDailyBudget`, rien n'est calculé ici : c'est ce qui
 * garantit que la définition d'un plateau ou d'un rythme réel n'existe qu'à un
 * seul endroit, et que le moteur de conseils de la Phase 6 y lira la même.
 */
export function useProgress(period: ProgressPeriod): ProgressSummary | undefined {
  const profile = useStoredProfile();
  const plan = useCaloriePlan(profile);
  const history = useWeightHistory();

  return useMemo(() => {
    if (!profile || !plan) {
      return undefined;
    }

    return buildProgressSummary({
      entries: history,
      period,
      // Le rythme visé est celui qui reste **après** les garde-fous, pas celui
      // que l'utilisateur avait demandé : comparer sa perte réelle à un rythme
      // que l'app a elle-même écrêté lui donnerait un retard imaginaire.
      plannedWeeklyLossKg: plan.target.effectiveWeeklyRateKg,
      maxSafeWeeklyLossKg: getMaxWeeklyRateKg(profile.currentWeightKg),
      targetWeightKg: profile.targetWeightKg,
      today: todayIsoDate(),
    });
  }, [profile, plan, history, period]);
}
