import type { UserProfile } from '@/domain/profile/types';

import { PROGRAMS } from './content/programs';
import type { Equipment, Program, TrainingLevel } from './types';

/**
 * Sélection du programme adapté au profil.
 *
 * ## Le niveau n'est pas déclaré, et on ne le devine pas au hasard
 *
 * `UserProfile` ne porte aucun niveau d'entraînement — l'onboarding ne le
 * demande pas. Le seul indice disponible est le nombre de jours d'entraînement
 * par semaine, qui dit la disponibilité plus que l'expérience.
 *
 * On en tire donc un niveau **par défaut prudent** : à disponibilité égale, le
 * programme le moins avancé l'emporte. Un programme de débutant est sans danger
 * pour quelqu'un d'expérimenté — il le trouvera facile — alors que l'inverse ne
 * l'est pas. Proposer un Push/Pull/Legs à six séances à qui découvre la barre
 * serait le genre d'erreur qu'on ne rattrape pas.
 *
 * Un niveau auto-déclaré à l'onboarding lèverait cette approximation ; c'est un
 * ajout de contenu d'écran, hors du périmètre de cette phase.
 */

/** Ordre de prudence : à égalité de pertinence, on retient le premier. */
const LEVEL_ORDER: readonly TrainingLevel[] = ['beginner', 'intermediate', 'advanced'];

/**
 * Niveau maximal qu'on se permet de **recommander**.
 *
 * Le nombre de jours disponibles dit la disponibilité, pas l'expérience :
 * quelqu'un peut avoir six soirées libres et n'avoir jamais tenu une barre.
 * Un programme avancé reste donc consultable — il figure dans
 * `eligiblePrograms` — mais n'est jamais celui qu'on met en avant.
 */
const MAX_RECOMMENDED_LEVEL: TrainingLevel = 'intermediate';

export interface ProgramSelectionInput {
  profile: UserProfile;
  /** Catalogue à parcourir. Celui livré par défaut si absent. */
  programs?: readonly Program[];
}

/**
 * Matériel disponible, déduit du profil sportif.
 *
 * Le profil parle d'environnements (`gym` / `home`), les exercices de matériel
 * (`gym` / `none`) : la traduction est explicite plutôt que devinée, les deux
 * vocabulaires n'ayant pas le même sens du mot « none ».
 */
export function availableEquipment(profile: UserProfile): Equipment[] {
  const environments = profile.sportProfile?.strengthEnvironments ?? [];
  const equipment: Equipment[] = [];

  if (environments.includes('gym')) {
    equipment.push('gym');
  }

  if (environments.includes('home')) {
    equipment.push('none');
  }

  // Sans environnement déclaré, on suppose le sans-matériel : c'est le seul
  // qui ne demande rien à personne.
  return equipment.length > 0 ? equipment : ['none'];
}

/**
 * Programmes compatibles avec le profil, du plus adapté au moins adapté.
 *
 * Ne renvoie jamais un programme qui demande un matériel dont la personne ne
 * dispose pas : proposer un développé couché à qui s'entraîne dans son salon
 * n'est pas un conseil, c'est un obstacle.
 */
export function eligiblePrograms(input: ProgramSelectionInput): Program[] {
  const catalogue = input.programs ?? PROGRAMS;
  const equipment = availableEquipment(input.profile);
  const availableDays = input.profile.trainingDaysPerWeek;

  return catalogue
    .filter((program) => equipment.includes(program.equipment))
    .filter((program) => program.daysPerWeek <= Math.max(availableDays, 1))
    .sort((a, b) => compareProgramFit(a, b, availableDays));
}

/**
 * Le programme recommandé, ou `undefined` si aucun ne convient.
 *
 * Le mieux ajusté aux jours disponibles, **plafonné à un niveau intermédiaire**.
 * Les deux critères ne se contredisent pas : remplir les jours disponibles est
 * une question de cohérence du programme, ne pas prescrire d'avancé est une
 * question de prudence. Un avancé qui trouve la recommandation trop simple ira
 * la changer ; un débutant à qui l'on prescrit six séances hebdomadaires ne
 * saura pas que c'était une erreur.
 *
 * Aucun résultat est un cas normal : quelqu'un qui déclare zéro jour
 * d'entraînement n'a pas de programme à suivre, et lui en imposer un serait
 * ignorer ce qu'il a répondu.
 */
export function recommendProgram(input: ProgramSelectionInput): Program | undefined {
  const ceiling = LEVEL_ORDER.indexOf(MAX_RECOMMENDED_LEVEL);

  return eligiblePrograms(input).find((program) => LEVEL_ORDER.indexOf(program.level) <= ceiling);
}

/**
 * Classement : on remplit d'abord les jours disponibles, puis on privilégie le
 * niveau le plus accessible, puis l'identifiant pour rester déterministe.
 *
 * Le nombre de séances prime parce qu'un programme à trois jours suivi quatre
 * fois par semaine perd son équilibre, alors qu'un programme à quatre jours
 * pour quelqu'un qui en a cinq reste cohérent.
 */
function compareProgramFit(a: Program, b: Program, availableDays: number): number {
  const fit = Math.abs(availableDays - a.daysPerWeek) - Math.abs(availableDays - b.daysPerWeek);

  if (fit !== 0) {
    return fit;
  }

  const level = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);

  if (level !== 0) {
    return level;
  }

  return a.id < b.id ? -1 : 1;
}
