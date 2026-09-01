import {
  recalculateForNewWeight,
  type AdaptiveRecalculationResult,
} from '@/domain/nutrition/energy';
import type { UserProfile } from '@/domain/profile/types';

/**
 * Politique de recalcul adaptatif.
 *
 * `recalculateForNewWeight` (Phase 1 §8) sait recalculer BMR, TDEE et objectif
 * pour un nouveau poids. Ce qu'il ne dit pas, c'est **quand** le faire ni **sur
 * quel poids** — et c'est là que se joue le caractère non anxiogène de la
 * fonction. Deux règles, indépendantes l'une de l'autre :
 *
 * 1. **On recalcule sur le poids lissé**, jamais sur la dernière pesée. Une
 *    journée salée ferait autrement bouger l'objectif calorique du lendemain.
 * 2. **On réaligne souvent, on prévient rarement.** Le profil suit le poids dès
 *    qu'il a bougé d'un demi-kilo, pour que les chiffres restent justes ; mais
 *    l'utilisateur n'est prévenu que si l'objectif en ressort modifié d'au moins
 *    `ADAPTIVE_NOTIFY_THRESHOLD_KCAL`. Annoncer « ton objectif passe de 2 040 à
 *    2 032 kcal » ne rend service à personne.
 *
 * Cette discrétion ne contredit pas la règle « aucun ajustement silencieux » des
 * garde-fous : `recalculateForNewWeight` force la notification dès qu'un
 * garde-fou apparaît qui n'était pas déjà actif. Un plancher calorique qui se
 * déclenche est donc toujours annoncé, quel que soit l'écart en kcal.
 */

/**
 * Écart de poids à partir duquel le profil est réaligné.
 *
 * Un demi-kilo est l'ordre de grandeur de la reproductibilité d'une balance
 * domestique. En dessous, on écrirait en base — et on marquerait une ligne à
 * synchroniser — pour une variation que l'instrument ne mesure pas vraiment.
 */
export const ADAPTIVE_MIN_WEIGHT_DELTA_KG = 0.5;

export interface AdaptiveEvaluation {
  /** Poids lissé confronté au profil. */
  referenceWeightKg: number;
  /** Écart avec le poids du profil. Signé, négatif pour une perte. */
  weightDeltaKg: number;
  /** Vrai si le profil doit être réaligné sur ce poids. */
  shouldUpdateProfile: boolean;
  /** Détail du recalcul, présent seulement si le profil doit être réaligné. */
  recalculation?: AdaptiveRecalculationResult;
  /** Vrai si l'ajustement mérite d'être expliqué à l'utilisateur. */
  shouldNotifyUser: boolean;
}

export function evaluateAdaptiveTarget(input: {
  profile: UserProfile;
  /** Poids lissé issu de la tendance (`resolveReferenceWeightKg`). */
  referenceWeightKg: number;
  now?: Date;
}): AdaptiveEvaluation {
  const weightDeltaKg =
    Math.round((input.referenceWeightKg - input.profile.currentWeightKg) * 100) / 100;

  if (Math.abs(weightDeltaKg) < ADAPTIVE_MIN_WEIGHT_DELTA_KG) {
    return {
      referenceWeightKg: input.referenceWeightKg,
      weightDeltaKg,
      shouldUpdateProfile: false,
      shouldNotifyUser: false,
    };
  }

  const recalculation = recalculateForNewWeight({
    profile: input.profile,
    newWeightKg: input.referenceWeightKg,
    now: input.now,
  });

  return {
    referenceWeightKg: input.referenceWeightKg,
    weightDeltaKg,
    shouldUpdateProfile: true,
    recalculation,
    shouldNotifyUser: recalculation.shouldNotifyUser,
  };
}

/** Profil réaligné sur le poids lissé. Ne mute pas l'original. */
export function applyAdaptiveWeight(profile: UserProfile, referenceWeightKg: number): UserProfile {
  return { ...profile, currentWeightKg: referenceWeightKg };
}
