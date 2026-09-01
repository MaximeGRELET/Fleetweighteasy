import { STABLE_BAND_WEEKLY_KG } from '@/domain/progress/assessment';
import { daysBetween } from '@/domain/progress/calendar';
import type { ProgressStatus } from '@/domain/progress/types';

import type { AdviceContext } from './types';

/**
 * Construction du contexte de conseil.
 *
 * Fonction pure : la date du jour est injectée, jamais lue. Toutes les
 * situations dont dépendent les briques se dérivent ici, à un seul endroit —
 * sans quoi « nouvel utilisateur » ou « écart récent » finiraient définis
 * différemment dans deux écrans.
 */

/**
 * Durée pendant laquelle on considère quelqu'un comme débutant.
 *
 * Une semaine : le temps de prendre l'habitude de noter ses repas, ce que la
 * brique d'accueil promet explicitement. Au-delà, continuer à souhaiter la
 * bienvenue serait à côté de la plaque.
 */
export const NEW_USER_DAYS = 7;

/** Une pesée hebdomadaire suffit à suivre la tendance (PHASES_2_A_5 §5.2). */
export const WEIGH_IN_WINDOW_DAYS = 7;

/**
 * Dépassement à partir duquel on parle d'écart.
 *
 * 25 % au-dessus du budget, soit quelques centaines de kilocalories : un vrai
 * repas de sortie, pas le bruit d'une estimation de portion. Le seuil est
 * volontairement atteignable — un faux positif affiche un message chaleureux et
 * déculpabilisant à quelqu'un qui n'en avait pas besoin, tandis qu'un faux
 * négatif laisse sans réponse précisément la personne tentée de compenser en
 * sautant le repas suivant. L'asymétrie penche d'un seul côté.
 */
export const SLIP_OVER_BUDGET_RATIO = 1.25;

/**
 * Fenêtre de détection d'un écart : aujourd'hui et la veille.
 *
 * La brique correspondante conseille de « reprendre au prochain repas » ; ce
 * conseil n'a plus de sens trois jours plus tard, et le message deviendrait un
 * rappel insistant de quelque chose que la personne a déjà dépassé.
 */
export const SLIP_LOOKBACK_DAYS = 2;

/** Bilan calorique d'une journée, tel que le journal le connaît. */
export interface DailyIntake {
  date: string;
  consumedKcal: number;
  /** Budget du jour, dans le mode de calories réglé au profil. */
  budgetKcal: number;
}

export interface AdviceContextInput {
  /** Date du jour, injectée pour garder la fonction pure. */
  today: string;
  /** Première activité connue — première pesée ou première entrée de journal. */
  startedOn?: string;
  lastWeighedOn?: string;
  loggedTodayCount: number;
  /** Journées récentes, pour la détection d'écart. L'ordre est libre. */
  recentDays?: readonly DailyIntake[];
  /** Lecture de la progression (Phase 5), quand elle est disponible. */
  progress?: {
    status: ProgressStatus;
    /** Rythme observé en kg/semaine, signé. */
    observedWeeklyRateKg?: number;
  };
}

export function buildAdviceContext(input: AdviceContextInput): AdviceContext {
  // Sans aucune activité, on est au premier jour : quelqu'un qui a terminé
  // l'onboarding sans rien noter est bien un débutant, quelle que soit la date
  // à laquelle il l'a fait.
  const daysSinceStart = input.startedOn ? daysBetween(input.startedOn, input.today) : 0;

  return {
    isNewUser: daysSinceStart < NEW_USER_DAYS,
    daysSinceStart,
    plateauDetected: input.progress?.status === 'plateau',
    recentSlipDetected: detectRecentSlip(input.recentDays ?? [], input.today),
    weightTrend: resolveWeightTrend(input.progress),
    loggedTodayCount: input.loggedTodayCount,
    hasWeighedThisWeek: hasWeighedWithinWindow(input.lastWeighedOn, input.today),
  };
}

/**
 * Un dépassement marqué sur la fenêtre récente.
 *
 * Un budget nul ou négatif n'est pas comparable — le rapport n'aurait pas de
 * sens — et la journée est simplement ignorée plutôt que comptée comme un écart.
 */
export function detectRecentSlip(days: readonly DailyIntake[], today: string): boolean {
  return days.some((day) => {
    const age = daysBetween(day.date, today);

    if (age < 0 || age >= SLIP_LOOKBACK_DAYS) {
      return false;
    }

    return day.budgetKcal > 0 && day.consumedKcal >= day.budgetKcal * SLIP_OVER_BUDGET_RATIO;
  });
}

/**
 * Tendance du poids, lue sur le rythme observé plutôt que sur le statut.
 *
 * Le statut de progression compare la perte au **plan** : « sur ton rythme »
 * signifie une chose pour une perte visée, une autre pour un maintien. La
 * tendance, elle, ne décrit que le sens de la courbe, et se lit donc
 * directement sur la pente — avec la même bande de stabilité que la Phase 5,
 * pour que les deux couches ne puissent pas qualifier différemment la même
 * série.
 */
function resolveWeightTrend(
  progress: AdviceContextInput['progress'],
): AdviceContext['weightTrend'] {
  const rate = progress?.observedWeeklyRateKg;

  if (rate === undefined) {
    return 'insufficient_data';
  }

  if (rate < -STABLE_BAND_WEEKLY_KG) {
    return 'down';
  }

  if (rate > STABLE_BAND_WEEKLY_KG) {
    return 'up';
  }

  return 'stable';
}

function hasWeighedWithinWindow(lastWeighedOn: string | undefined, today: string): boolean {
  if (!lastWeighedOn) {
    return false;
  }

  const age = daysBetween(lastWeighedOn, today);
  return age >= 0 && age < WEIGH_IN_WINDOW_DAYS;
}
