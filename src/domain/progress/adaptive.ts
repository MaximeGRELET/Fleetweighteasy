import {
  recalculateForNewWeight,
  type AdaptiveRecalculationResult,
} from '@/domain/nutrition/energy';
import type { UserProfile } from '@/domain/profile/types';

/**
 * Politique de recalcul adaptatif.
 *
 * `recalculateForNewWeight` (Phase 1 §8) sait recalculer BMR, TDEE et objectif
 * pour un nouveau poids. Ce qu'il ne dit pas, c'est **quand** le faire, **sur
 * quel poids**, ni **à quoi comparer le résultat** — et c'est là que se joue le
 * caractère non anxiogène de la fonction. Trois règles :
 *
 * 1. **On recalcule sur le poids lissé**, jamais sur la dernière pesée. Une
 *    journée salée ferait autrement bouger l'objectif calorique du lendemain.
 * 2. **On réaligne souvent, on prévient rarement.** Le profil suit le poids dès
 *    qu'il a bougé d'un demi-kilo, pour que les chiffres restent justes ; mais
 *    l'utilisateur n'est prévenu que si l'objectif en ressort modifié d'au moins
 *    `ADAPTIVE_NOTIFY_THRESHOLD_KCAL`. Annoncer « ton objectif passe de 2 040 à
 *    2 032 kcal » ne rend service à personne.
 * 3. **Le seuil se mesure depuis le dernier objectif annoncé**, et non depuis le
 *    recalcul précédent. C'est la règle qui empêche la dérive silencieuse
 *    décrite ci-dessous ; elle est la raison d'être de `lastNotifiedWeightKg`.
 *
 * ## Pourquoi la comparaison ne peut pas être de proche en proche
 *
 * Le rythme visé étant proportionnel au poids, le déficit se resserre en même
 * temps que la dépense : l'objectif bouge donc lentement. Sur un profil type,
 * un palier de 0,5 kg ne déplace l'objectif que de ~4 kcal. Comparer chaque
 * recalcul au précédent laisserait donc passer vingt paliers d'affilée — soit
 * 10 kg et 73 kcal d'écart cumulé — sans jamais franchir le seuil à un pas
 * donné. L'utilisateur se retrouverait avec un objectif sensiblement différent
 * de celui qu'on lui a annoncé, sans qu'on le lui ait jamais dit.
 *
 * La base de comparaison est donc le **poids de la dernière annonce**, remis à
 * jour uniquement quand une notification part réellement.
 *
 * ## Pourquoi un poids, et non l'objectif en kcal
 *
 * Mémoriser le nombre de kcal annoncé le figerait sous les hypothèses du
 * moment. Si l'utilisateur change de niveau d'activité ou d'objectif, ce nombre
 * deviendrait faux, et la comparaison suivante rapporterait un écart qui ne
 * doit rien au poids. En mémorisant un poids, la référence est **recalculée**
 * par `calculateCalorieTarget` avec le profil courant : un changement de
 * réglage, que l'utilisateur a déjà vu à l'écran, ne se fait pas annoncer
 * deux fois.
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
  /** Poids de la dernière annonce, qui sert de base au seuil de notification. */
  notifiedFromWeightKg: number;
  /**
   * Recalcul **depuis la dernière annonce**, toujours présent.
   *
   * C'est lui que la couche message met en mots : son `previous` est le dernier
   * objectif que l'utilisateur ait vu, ce qui rend la phrase « ton objectif
   * passe de X à Y » littéralement vraie.
   */
  recalculation: AdaptiveRecalculationResult;
  /** Vrai si le profil doit être réaligné sur le poids lissé. */
  shouldUpdateProfile: boolean;
  /** Vrai si l'ajustement mérite d'être expliqué à l'utilisateur. */
  shouldNotifyUser: boolean;
}

export function evaluateAdaptiveTarget(input: {
  profile: UserProfile;
  /** Poids lissé issu de la tendance (`resolveReferenceWeightKg`). */
  referenceWeightKg: number;
  now?: Date;
}): AdaptiveEvaluation {
  const { profile, referenceWeightKg } = input;

  // Sans annonce antérieure, la référence est le poids du profil : c'est celui
  // de la restitution d'onboarding, donc bien le dernier objectif montré.
  const notifiedFromWeightKg = profile.lastNotifiedWeightKg ?? profile.currentWeightKg;

  const weightDeltaKg = roundToDecagram(referenceWeightKg - profile.currentWeightKg);

  // Le recalcul de notification part du dernier poids annoncé, jamais du poids
  // courant du profil : c'est toute la différence entre mesurer une marche et
  // mesurer l'escalier.
  const recalculation = recalculateForNewWeight({
    profile: { ...profile, currentWeightKg: notifiedFromWeightKg },
    newWeightKg: referenceWeightKg,
    now: input.now,
  });

  const shouldNotifyUser = recalculation.shouldNotifyUser;

  return {
    referenceWeightKg,
    weightDeltaKg,
    notifiedFromWeightKg,
    recalculation,
    // Une notification annonce un nouvel objectif : le profil doit le porter,
    // même si le pas du jour est inférieur au seuil de réalignement.
    shouldUpdateProfile:
      Math.abs(weightDeltaKg) >= ADAPTIVE_MIN_WEIGHT_DELTA_KG || shouldNotifyUser,
    shouldNotifyUser,
  };
}

/**
 * Applique le résultat d'une évaluation au profil. Ne mute pas l'original.
 *
 * Les deux effets sont appliqués ensemble, et c'est délibéré : un appelant qui
 * réalignerait le poids en oubliant de déplacer la base d'annonce rouvrirait
 * exactement la dérive que cette base sert à empêcher.
 */
export function applyAdaptiveEvaluation(
  profile: UserProfile,
  evaluation: AdaptiveEvaluation,
): UserProfile {
  if (!evaluation.shouldUpdateProfile) {
    return profile;
  }

  return {
    ...profile,
    currentWeightKg: evaluation.referenceWeightKg,
    // La base d'annonce est **épinglée** dès le premier réalignement, à la
    // valeur qui a servi de référence — c'est-à-dire au poids de la dernière
    // restitution. Sans cette écriture, le repli `?? currentWeightKg` suivrait
    // le poids réaligné et remettrait l'écart cumulé à zéro à chaque palier :
    // la dérive silencieuse reviendrait par la porte de derrière.
    lastNotifiedWeightKg: evaluation.shouldNotifyUser
      ? evaluation.referenceWeightKg
      : evaluation.notifiedFromWeightKg,
  };
}

/** Arrondi à 10 g : en deçà, on comparerait du bruit de balance. */
function roundToDecagram(value: number): number {
  return Math.round(value * 100) / 100;
}
