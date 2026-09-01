import type { AdaptiveRecalculationResult } from '@/domain/nutrition/energy';
import type { AdaptiveEvaluation } from '@/domain/progress/adaptive';
import { MIN_SPAN_DAYS_FOR_RATE } from '@/domain/progress/rate';
import type { ProgressSummary } from '@/domain/progress/summary';
import { DEFAULT_TREND_WINDOW_DAYS } from '@/domain/progress/trend';
import type { ProgressStatus } from '@/domain/progress/types';
import { formatKcal, formatKg, formatWeeklyRate } from '@/lib/format';

import { explainCalorieTarget, type Explanation } from './safety';

/**
 * Mise en mots du suivi du poids.
 *
 * Le domaine classe, cette couche formule. Deux règles de ton, qui ne sont pas
 * décoratives :
 *
 * **Aucun message ne fait porter la faute à l'utilisateur.** Un rythme plus lent
 * que prévu vient au moins autant de l'estimation de dépense — un modèle
 * statistique appliqué à un individu — que du comportement de la personne. Les
 * textes le disent explicitement.
 *
 * **Un plateau et une reprise sont présentés comme des étapes banales**, parce
 * qu'ils le sont. C'est la brique de conseil de la Phase 6 qui proposera quoi
 * faire ; ici, on explique ce qui se passe et on désamorce l'inquiétude.
 */

/** Contexte de rédaction, dérivé une seule fois du résumé. */
interface StatusContext {
  /** Perte observée en kg/semaine — positive pour une perte, négative pour une reprise. */
  observedWeeklyLossKg: number;
  plannedWeeklyLossKg: number;
  /** Durée sur laquelle la tendance est mesurée, en semaines pleines. */
  spanWeeks: number;
}

const DAYS_PER_WEEK = 7;

const STATUS_EXPLANATIONS: Record<ProgressStatus, (context: StatusContext) => Explanation> = {
  insufficient_data: () => ({
    id: 'progress_insufficient_data',
    tone: 'neutral',
    title: 'Encore un peu de recul à prendre',
    body:
      `Il faut environ ${MIN_SPAN_DAYS_FOR_RATE} jours de pesées pour qu’une tendance veuille ` +
      `dire quelque chose. Ta courbe s’affiche déjà, mais on préfère ne pas t’annoncer un rythme ` +
      `que les prochains jours démentiraient.`,
  }),

  on_track: (context) => ({
    id: 'progress_on_track',
    tone: 'neutral',
    title: 'Tu es sur ton rythme',
    body:
      `Sur les ${context.spanWeeks} dernières semaines, ta tendance descend d’environ ` +
      `${formatWeeklyRate(context.observedWeeklyLossKg)}, pour un objectif de ` +
      `${formatWeeklyRate(context.plannedWeeklyLossKg)}. Il n’y a rien à changer.`,
  }),

  slower_than_planned: (context) => ({
    id: 'progress_slower_than_planned',
    tone: 'neutral',
    title: 'Ça descend, un peu plus lentement que prévu',
    body:
      `Ta tendance perd environ ${formatWeeklyRate(context.observedWeeklyLossKg)}, là où le plan ` +
      `visait ${formatWeeklyRate(context.plannedWeeklyLossKg)}. L’écart n’a rien d’alarmant : la ` +
      `dépense énergétique est estimée par une formule statistique, qui se trompe couramment de ` +
      `10 à 15 % sur une personne donnée. Un rythme plus lent est aussi un rythme qui tient ` +
      `dans la durée.`,
  }),

  plateau: (context) => ({
    id: 'progress_plateau',
    tone: 'neutral',
    title: 'Ton poids s’est stabilisé',
    body:
      `Depuis environ ${context.spanWeeks} semaines, ta tendance ne descend plus. C’est une ` +
      `étape banale d’une perte de poids, pas un échec : le corps réduit sa dépense à mesure ` +
      `qu’il s’allège, et la rétention d’eau masque souvent plusieurs semaines de perte réelle. ` +
      `Continue à te peser normalement, la courbe repart en général d’elle-même.`,
  }),

  gaining: (context) => ({
    id: 'progress_gaining',
    tone: 'neutral',
    title: 'Ta tendance est repartie à la hausse',
    body:
      `Ta tendance remonte d’environ ${formatWeeklyRate(-context.observedWeeklyLossKg)}. Sur ` +
      `quelques semaines, cela vient aussi souvent d’une reprise du sport, d’une alimentation ` +
      `plus salée ou d’une variation d’eau que d’un véritable gain de masse grasse. Ce que tu ` +
      `vois ici est un constat, pas un verdict.`,
  }),

  unplanned_loss: (context) => ({
    id: 'progress_unplanned_loss',
    tone: 'caution',
    title: 'Ton poids baisse, alors que tu vises le maintien',
    body:
      `Ta tendance perd environ ${formatWeeklyRate(context.observedWeeklyLossKg)}, alors que ton ` +
      `objectif est de te maintenir. Si ce n’est pas voulu, il y a probablement un écart entre ` +
      `ta dépense réelle et celle qui a été estimée : revoir ton niveau d’activité dans ton ` +
      `profil est le premier réflexe.`,
  }),

  faster_than_safe: (context) => ({
    id: 'progress_faster_than_safe',
    tone: 'caution',
    title: 'Tu perds plus vite que le rythme conseillé',
    body:
      `Ta tendance descend d’environ ${formatWeeklyRate(context.observedWeeklyLossKg)}, au-delà ` +
      `de ce qui est recommandé pour ton poids. Passé environ 1 % du poids du corps par semaine, ` +
      `la perte se fait de plus en plus aux dépens du muscle, et la fatigue s’installe. Manger ` +
      `un peu plus n’est pas un renoncement : c’est ce qui protège les résultats déjà obtenus. ` +
      `Si la perte se poursuit à ce rythme sans que tu la cherches, parles-en à un professionnel ` +
      `de santé.`,
  }),
};

/**
 * Explique la progression. Renvoie toujours un message : une courbe sans
 * commentaire laisse l'utilisateur l'interpréter seul, et c'est précisément là
 * que naît l'inquiétude.
 */
export function explainProgressStatus(summary: ProgressSummary): Explanation {
  return STATUS_EXPLANATIONS[summary.status](toStatusContext(summary));
}

function toStatusContext(summary: ProgressSummary): StatusContext {
  const observed = summary.observed;

  return {
    // Le domaine raisonne en variation signée, les messages en perte : une pente
    // de −0,4 kg/semaine se raconte comme « tu perds 0,4 kg par semaine ».
    observedWeeklyLossKg: observed ? -observed.weeklyRateKg : 0,
    plannedWeeklyLossKg: summary.plannedWeeklyLossKg,
    spanWeeks: observed ? Math.round(observed.spanDays / DAYS_PER_WEEK) : 0,
  };
}

/**
 * Explique un recalcul adaptatif de l'objectif.
 *
 * Renvoie une liste vide tant que l'ajustement reste sous le seuil : c'est le
 * comportement voulu (PHASE_1 §8), pas un oubli. Les garde-fous, eux, ne sont
 * jamais tus — `recalculateForNewWeight` force la notification dès qu'un
 * nouveau se déclenche, et son message est ajouté ici.
 */
export function explainAdaptiveAdjustment(evaluation: AdaptiveEvaluation): Explanation[] {
  if (!evaluation.shouldNotifyUser) {
    return [];
  }

  return [
    buildAdaptiveExplanation(evaluation.recalculation),
    ...newSafetyExplanations(evaluation.recalculation),
  ];
}

function buildAdaptiveExplanation(recalculation: AdaptiveRecalculationResult): Explanation {
  const { previous, next, weightDeltaKg, targetDeltaKcal } = recalculation;

  const cause =
    weightDeltaKg < 0
      ? `Tu as perdu ${formatKg(Math.abs(weightDeltaKg))} depuis la dernière mise à jour de ton ` +
        `objectif. Un corps plus léger dépense un peu moins d’énergie, au repos comme en mouvement.`
      : `Ton poids a augmenté de ${formatKg(Math.abs(weightDeltaKg))} depuis la dernière mise à ` +
        `jour de ton objectif. Un corps plus lourd dépense un peu plus d’énergie.`;

  const direction = targetDeltaKcal > 0 ? '+' : '−';

  return {
    id: 'adaptive_target_updated',
    tone: 'neutral',
    title: 'Ton objectif a été réajusté',
    body:
      `${cause} Ta dépense estimée passe de ${formatKcal(previous.tdeeKcal)} à ` +
      `${formatKcal(next.tdeeKcal)} par jour, et ton objectif de ` +
      `${formatKcal(previous.targetKcal)} à ${formatKcal(next.targetKcal)} ` +
      `(${direction}${formatKcal(Math.abs(targetDeltaKcal))}). C’est le signe que le calcul ` +
      `suit ton corps — pas que tu as fait quoi que ce soit de travers.`,
  };
}

/**
 * Garde-fous apparus avec le nouveau poids, et eux seuls.
 *
 * Réafficher ceux qui étaient déjà actifs ferait doublon avec l'écran où
 * l'utilisateur les a déjà lus — même règle que `WARNINGS_COVERED_BY_ADJUSTMENT`
 * applique entre ajustements et avertissements.
 */
function newSafetyExplanations(recalculation: AdaptiveRecalculationResult): Explanation[] {
  const alreadyKnown = new Set(explainCalorieTarget(recalculation.previous).map(({ id }) => id));

  return explainCalorieTarget(recalculation.next).filter(({ id }) => !alreadyKnown.has(id));
}

/**
 * Pédagogie de la pesée.
 *
 * La spécification demande de recommander la pesée hebdomadaire sans interdire
 * la pesée quotidienne (PHASES_2_A_5 §5.2) : certaines personnes se rassurent en
 * se pesant tous les jours, d'autres s'en angoissent. On explique le bruit, on
 * laisse choisir.
 */
export const WEIGHING_GUIDANCE: Explanation = {
  id: 'weighing_guidance',
  tone: 'neutral',
  title: 'Comment lire cette courbe',
  body:
    `Le poids varie d’un à deux kilos d’un jour à l’autre sans qu’aucune graisse n’ait bougé : ` +
    `eau, digestion, cycle hormonal. C’est pourquoi la ligne pleine — la moyenne des ` +
    `${DEFAULT_TREND_WINDOW_DAYS} derniers jours — compte davantage que les points. Te peser une ` +
    `fois par semaine, toujours dans les mêmes conditions, suffit largement ; tous les jours ` +
    `fonctionne aussi, à condition de regarder la ligne plutôt que le point du matin.`,
};

/** Affiché tant que la moyenne mobile ne repose que sur une seule pesée. */
export const TREND_NOT_ESTABLISHED =
  'Une seule pesée sur la fenêtre : la ligne suit encore le point, elle se lissera avec les suivantes.';
