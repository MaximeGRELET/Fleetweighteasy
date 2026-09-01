import { useMemo } from 'react';

import { buildAdviceContext, type DailyIntake } from '@/domain/advice/context';
import { selectAdvice } from '@/domain/advice/engine';
import type { AdviceSelection } from '@/domain/advice/types';
import { addDays } from '@/domain/progress/calendar';
import { todayIsoDate } from '@/stores/session';

import { useDailyBudget } from './use-daily-budget';
import { useJournalDay } from './use-journal';
import { useProgress } from './use-progress';
import { useCaloriePlan, useStoredProfile } from './use-profile';
import { useRepositories } from './use-repositories';
import { useWeightHistory } from './use-weight';

/**
 * Conseil du jour et section conseils.
 *
 * Assemble la situation courante — ancienneté, plateau, écart récent, pesée de
 * la semaine — et la confie au moteur. Rien n'est décidé ici : ni quelle brique
 * montrer, ni ce qu'est un écart, ni quel garde-fou prime. Ce hook lit et
 * transmet, pour que deux écrans ne puissent pas arbitrer différemment.
 */
export function useAdvice(): AdviceSelection | undefined {
  const repositories = useRepositories();
  const profile = useStoredProfile();
  const plan = useCaloriePlan(profile);

  const today = todayIsoDate();
  const yesterday = addDays(today, -1);

  // La progression est lue sur tout l'historique : le conseil ne doit pas
  // changer parce que l'utilisateur a choisi une autre période sur la courbe.
  const progress = useProgress('all');
  const weightHistory = useWeightHistory();

  const todayJournal = useJournalDay(today);
  const todayBudget = useDailyBudget(today);
  const yesterdayBudget = useDailyBudget(yesterday);

  return useMemo(() => {
    if (!profile || !plan) {
      return undefined;
    }

    const recentDays: DailyIntake[] = [
      toDailyIntake(today, todayBudget),
      toDailyIntake(yesterday, yesterdayBudget),
    ].filter((day): day is DailyIntake => day !== undefined);

    const context = buildAdviceContext({
      today,
      startedOn: resolveStartedOn(weightHistory[0]?.date, repositories.foodLog.getFirstEntryDate()),
      lastWeighedOn: weightHistory[weightHistory.length - 1]?.date,
      loggedTodayCount: todayJournal.entries.length,
      recentDays,
      progress: progress
        ? { status: progress.status, observedWeeklyRateKg: progress.observed?.weeklyRateKg }
        : undefined,
    });

    return selectAdvice({
      profile,
      context,
      safety: {
        target: plan.target,
        // Les signaux de risque attendent un historique des objectifs successifs
        // qu'aucune table ne conserve encore (PHASE_1 §5.5). La bande est prête
        // à les recevoir ; il n'y a simplement rien à lui donner aujourd'hui.
        riskSignals: [],
      },
    });
  }, [
    profile,
    plan,
    progress,
    weightHistory,
    todayJournal.entries.length,
    todayBudget,
    yesterdayBudget,
    repositories,
    today,
    yesterday,
  ]);
}

/**
 * Première trace d'utilisation, pesée ou repas confondus.
 *
 * On prend la plus ancienne des deux : quelqu'un qui note ses repas sans se
 * peser n'est pas un nouvel utilisateur, et l'inverse est vrai aussi.
 */
function resolveStartedOn(
  firstWeightDate: string | undefined,
  firstLogDate: string | undefined,
): string | undefined {
  const dates = [firstWeightDate, firstLogDate].filter(
    (date): date is string => date !== undefined,
  );

  return dates.length > 0 ? dates.sort()[0] : undefined;
}

function toDailyIntake(
  date: string,
  budget: { consumedKcal: number; active: { budgetKcal: number } } | undefined,
): DailyIntake | undefined {
  return budget
    ? { date, consumedKcal: budget.consumedKcal, budgetKcal: budget.active.budgetKcal }
    : undefined;
}
