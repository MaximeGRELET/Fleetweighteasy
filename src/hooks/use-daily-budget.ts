import { useMemo } from 'react';

import { buildDailyBudget, type DailyBudget } from '@/domain/journal/daily-budget';

import { useJournalDay } from './use-journal';
import { useCaloriePlan, useStoredProfile } from './use-profile';

/**
 * Tableau du jour, prêt à afficher.
 *
 * Assemble trois sources — l'objectif recalculé depuis le profil, la somme des
 * snapshots du journal, la dépense sportive estimée — et confie leur
 * combinaison au domaine (`buildDailyBudget`). Rien n'est calculé ici : c'est
 * ce qui garantit que la règle du `calorieMode` n'existe qu'à un seul endroit.
 */
export function useDailyBudget(date: string): DailyBudget | undefined {
  const profile = useStoredProfile();
  const plan = useCaloriePlan(profile);
  const day = useJournalDay(date);

  return useMemo(() => {
    if (!profile || !plan) {
      return undefined;
    }

    return buildDailyBudget({
      mode: profile.calorieMode,
      targetKcal: plan.target.targetKcal,
      macros: plan.macros,
      consumed: day.totals,
      exerciseKcal: day.exerciseKcal,
    });
  }, [profile, plan, day.totals, day.exerciseKcal]);
}
