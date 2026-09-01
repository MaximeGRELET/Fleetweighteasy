import { addDays, compareIsoDates, daysBetween } from './calendar';
import { assessProgress } from './assessment';
import { estimateObservedRate, type ObservedRate } from './rate';
import {
  buildWeightTrend,
  DEFAULT_TREND_WINDOW_DAYS,
  resolveReferenceWeightKg,
  trendChangeKg,
  type TrendPoint,
} from './trend';
import type { ProgressPeriod, ProgressStatus, WeightPoint } from './types';

/**
 * Assemble tout ce que l'écran de suivi affiche, en une seule lecture.
 *
 * Combinateur pur, sur le modèle de `buildDailyBudget` : il reçoit le rythme
 * visé déjà calculé plutôt que le profil, pour ne pas refaire le travail de
 * `calculateCalorieTarget` et pour rester éprouvable sans construire un profil
 * complet.
 */

/** Nombre de jours couverts par chaque période proposée. `all` n'en borne aucun. */
const PERIOD_DAYS: Record<Exclude<ProgressPeriod, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
};

export interface GoalProgress {
  /** Première pesée enregistrée : le point de départ réel, pas celui du profil. */
  startWeightKg: number;
  targetWeightKg: number;
  /** Poids lissé le plus récent. */
  currentWeightKg: number;
  /** Ce qu'il reste à parcourir. Signé, négatif si la cible est dépassée. */
  remainingKg: number;
  /**
   * Part du chemin parcouru. Non bornée, comme les jauges de macros : au-delà
   * de 1, la cible est dépassée, et c'est l'UI qui décide de tronquer la barre.
   */
  ratio: number;
}

export interface ProgressSummary {
  period: ProgressPeriod;
  /** Bornes effectivement observées. `fromDate` est absent pour la période `all`. */
  range: { fromDate?: string; toDate: string };
  /** Pesées de la période, triées par date croissante. */
  points: WeightPoint[];
  /** Série lissée correspondante — la donnée principale de la courbe. */
  trend: TrendPoint[];
  /** Variation sur la période, mesurée sur la tendance. Signée. */
  changeKg?: number;
  observed?: ObservedRate;
  /** Rythme visé, en kg/semaine de perte. */
  plannedWeeklyLossKg: number;
  status: ProgressStatus;
  goal?: GoalProgress;
  /** Poids lissé retenu pour le recalcul adaptatif. */
  referenceWeightKg?: number;
}

export interface ProgressSummaryInput {
  /** Historique complet des pesées. Le découpage par période se fait ici. */
  entries: readonly WeightPoint[];
  period: ProgressPeriod;
  /** Rythme visé (kg/semaine de perte), tel que borné par les garde-fous. */
  plannedWeeklyLossKg: number;
  /** Plafond de sécurité pour le poids courant. */
  maxSafeWeeklyLossKg: number;
  targetWeightKg?: number;
  /** Date du jour, injectée pour que la fonction reste pure. */
  today: string;
  trendWindowDays?: number;
}

export function buildProgressSummary(input: ProgressSummaryInput): ProgressSummary {
  const windowDays = input.trendWindowDays ?? DEFAULT_TREND_WINDOW_DAYS;
  const sorted = [...input.entries].sort((a, b) => compareIsoDates(a.date, b.date));
  const fromDate = resolvePeriodStart(input.period, input.today);

  const points = fromDate ? sorted.filter((point) => point.date >= fromDate) : sorted;

  // La tendance est calculée sur l'historique complet, puis restreinte à la
  // période. Sinon le premier point affiché repartirait d'une moyenne à un seul
  // échantillon, et la courbe montrerait une marche qui n'existe pas.
  const fullTrend = buildWeightTrend(sorted, windowDays);
  const trend = fromDate ? fullTrend.filter((point) => point.date >= fromDate) : fullTrend;

  const observed = estimateObservedRate(points);

  return {
    period: input.period,
    range: { fromDate, toDate: input.today },
    points,
    trend,
    changeKg: trendChangeKg(trend),
    observed,
    plannedWeeklyLossKg: input.plannedWeeklyLossKg,
    status: assessProgress({
      observed,
      plannedWeeklyLossKg: input.plannedWeeklyLossKg,
      maxSafeWeeklyLossKg: input.maxSafeWeeklyLossKg,
    }),
    goal: buildGoalProgress(sorted, fullTrend, input.targetWeightKg),
    // Référence adaptative : lue sur tout l'historique, jamais sur la période
    // affichée — changer de filtre ne doit pas changer l'objectif calorique.
    referenceWeightKg: resolveReferenceWeightKg(fullTrend),
  };
}

/** Première date incluse dans la période, ou `undefined` pour l'historique complet. */
export function resolvePeriodStart(period: ProgressPeriod, today: string): string | undefined {
  if (period === 'all') {
    return undefined;
  }

  // La période inclut aujourd'hui : 30 jours, c'est J−29 à J.
  return addDays(today, -(PERIOD_DAYS[period] - 1));
}

/**
 * Progression vers le poids cible.
 *
 * Le point de départ est la **première pesée enregistrée**, et non le poids du
 * profil : celui-ci est réaligné par le recalcul adaptatif, si bien que
 * l'utiliser ferait reculer la barre de progression à chaque ajustement — la
 * personne verrait son avancement s'effacer précisément parce qu'elle progresse.
 */
function buildGoalProgress(
  sorted: readonly WeightPoint[],
  fullTrend: readonly TrendPoint[],
  targetWeightKg: number | undefined,
): GoalProgress | undefined {
  if (targetWeightKg === undefined || fullTrend.length === 0) {
    return undefined;
  }

  const startWeightKg = sorted[0].weightKg;
  const currentWeightKg = fullTrend[fullTrend.length - 1].trendKg;

  const totalKg = startWeightKg - targetWeightKg;
  const doneKg = startWeightKg - currentWeightKg;

  return {
    startWeightKg,
    targetWeightKg,
    currentWeightKg,
    remainingKg: round1(currentWeightKg - targetWeightKg),
    // Une cible déjà atteinte au premier jour ne définit aucun chemin : le
    // rapport serait une division par zéro, propagée jusqu'à une largeur de
    // barre invalide.
    ratio: totalKg === 0 ? 1 : doneKg / totalKg,
  };
}

/** Nombre de jours de recul dont on dispose réellement, toutes pesées confondues. */
export function historySpanDays(entries: readonly WeightPoint[]): number {
  if (entries.length < 2) {
    return 0;
  }

  const sorted = [...entries].sort((a, b) => compareIsoDates(a.date, b.date));
  return daysBetween(sorted[0].date, sorted[sorted.length - 1].date);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
