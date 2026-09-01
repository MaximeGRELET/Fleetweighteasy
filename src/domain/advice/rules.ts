import type { ActivityLevel, UserProfile } from '@/domain/profile/types';

import type { AdviceBlock, AdviceContext, AdviceTag, AdviceTopic } from './types';

/**
 * Correspondance profil ↔ tags, et évaluation des conditions contextuelles.
 *
 * Séparé du moteur : ce fichier répond à « cette brique s'applique-t-elle ? »,
 * le moteur à « laquelle montrer ? ». Les deux questions changent pour des
 * raisons différentes.
 */

/**
 * Regroupement des cinq niveaux d'activité en trois paliers de conseil.
 *
 * Les tags servent à choisir un texte, pas à calculer : trois paliers suffisent
 * à distinguer les situations où le conseil diffère réellement, là où cinq
 * multiplieraient les variantes à rédiger sans rien apporter.
 */
const ACTIVITY_TAGS: Record<ActivityLevel, AdviceTag> = {
  sedentary: 'activity:low',
  lightly_active: 'activity:low',
  moderately_active: 'activity:moderate',
  very_active: 'activity:high',
  extremely_active: 'activity:high',
};

/**
 * Tags décrivant un profil à un instant donné.
 *
 * `isNewUser` vient du contexte et non du profil : l'ancienneté est une
 * situation, pas une caractéristique de la personne.
 */
export function profileTags(profile: UserProfile, context: AdviceContext): AdviceTag[] {
  const tags: AdviceTag[] = [
    `goal:${profile.goalType}`,
    `diet:${profile.dietType}`,
    ACTIVITY_TAGS[profile.activityLevel],
    context.isNewUser ? 'user:new' : 'user:established',
  ];

  const practices = profile.sportProfile?.practices ?? [];

  // Les deux disciplines peuvent coexister : quelqu'un qui court et soulève
  // porte les deux tags, et c'est la priorité qui tranchera entre les briques
  // « garde la muscu » et « ajoute de la résistance ».
  if (practices.includes('strength')) {
    tags.push('trains:strength');
  }

  if (practices.includes('cardio')) {
    tags.push('trains:cardio');
  }

  if (practices.length === 0) {
    tags.push('trains:none');
  }

  return tags;
}

/** Une brique est candidate si **tous** ses tags sont portés par le profil. */
export function matchesTags(block: AdviceBlock, tags: readonly AdviceTag[]): boolean {
  return block.tags.every((tag) => tags.includes(tag));
}

/**
 * Évalue la condition contextuelle d'une brique.
 *
 * Chaque champ de `requires` doit être **égal** à celui du contexte. Une
 * comparaison stricte, et non « véracité » : `hasWeighedThisWeek: false` doit
 * pouvoir exiger l'absence de pesée, ce qu'un test de véracité ne saurait pas
 * exprimer.
 */
export function satisfiesCondition(block: AdviceBlock, context: AdviceContext): boolean {
  const requires = block.condition?.requires;

  if (!requires) {
    return true;
  }

  return Object.entries(requires).every(
    ([key, expected]) => context[key as keyof AdviceContext] === expected,
  );
}

/**
 * Topics dont un autre écran porte déjà le message.
 *
 * `plateau` appartient à l'écran de suivi du poids : `explainProgressStatus`
 * (Phase 5) y explique déjà le palier, avec le nombre de semaines mesuré à
 * l'appui. Laisser le moteur afficher `plateau__default` en parallèle ferait
 * lire deux fois la même chose le même jour, sur deux écrans — exactement ce
 * que la règle « jamais dupliqué » proscrit.
 *
 * La brique reste dans le contenu : elle est écrite, validée, et redeviendra
 * utile le jour où le produit voudra que le moteur possède ce topic. C'est le
 * filtre qu'il faudra retirer, pas le texte à réécrire.
 */
export const TOPICS_OWNED_ELSEWHERE: readonly AdviceTopic[] = ['plateau'];

export function isOwnedElsewhere(topic: AdviceTopic): boolean {
  return TOPICS_OWNED_ELSEWHERE.includes(topic);
}
