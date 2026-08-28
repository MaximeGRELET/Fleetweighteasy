import { InvalidInputError } from '@/domain/errors';

import type {
  ActivityLevel,
  CalorieMode,
  DietType,
  GoalType,
  Sex,
  SportProfile,
  UserProfile,
} from './types';
import { DEFAULT_CALORIE_MODE } from './types';

/**
 * Profil en cours de saisie pendant l'onboarding.
 *
 * Chaque écran en renseigne une partie. Tant qu'il est incomplet, il ne peut pas
 * devenir un `UserProfile` : les formules exigent un profil entier, pas un objet
 * à trous.
 */
export interface ProfileDraft {
  goalType?: GoalType;
  sex?: Sex;
  birthDate?: string;
  heightCm?: number;
  currentWeightKg?: number;
  targetWeightKg?: number;
  activityLevel?: ActivityLevel;
  trainingDaysPerWeek?: number;
  sportProfile?: SportProfile;
  dietType?: DietType;
  allergies: string[];
  dislikes: string[];
  weeklyRateKg?: number;
  calorieMode: CalorieMode;
}

export const EMPTY_PROFILE_DRAFT: ProfileDraft = {
  allergies: [],
  dislikes: [],
  calorieMode: DEFAULT_CALORIE_MODE,
};

/** Champs sans lesquels aucun calcul n'est possible. */
const REQUIRED_FIELDS = [
  'goalType',
  'sex',
  'birthDate',
  'heightCm',
  'currentWeightKg',
  'activityLevel',
  'trainingDaysPerWeek',
  'dietType',
] as const satisfies readonly (keyof ProfileDraft)[];

export function missingDraftFields(draft: ProfileDraft): (keyof ProfileDraft)[] {
  return REQUIRED_FIELDS.filter((field) => draft[field] === undefined);
}

export function isDraftComplete(draft: ProfileDraft): boolean {
  return missingDraftFields(draft).length === 0;
}

/**
 * Assemble le profil définitif.
 *
 * Le rythme hebdomadaire n'est conservé qu'en perte de poids : le garder pour un
 * objectif de maintien ou de recomposition laisserait traîner une intention qui
 * n'a plus de sens, et que les formules ignoreraient de toute façon.
 */
export function buildUserProfile(draft: ProfileDraft): UserProfile {
  const {
    goalType,
    sex,
    birthDate,
    heightCm,
    currentWeightKg,
    activityLevel,
    trainingDaysPerWeek,
    dietType,
  } = draft;

  if (
    goalType === undefined ||
    sex === undefined ||
    birthDate === undefined ||
    heightCm === undefined ||
    currentWeightKg === undefined ||
    activityLevel === undefined ||
    trainingDaysPerWeek === undefined ||
    dietType === undefined
  ) {
    throw new InvalidInputError(
      'profileDraft',
      `Profil incomplet : ${missingDraftFields(draft).join(', ')} manquant(s).`,
    );
  }

  const keepsWeeklyRate = goalType === 'weight_loss' && draft.weeklyRateKg !== undefined;

  return {
    sex,
    birthDate,
    heightCm,
    currentWeightKg,
    goalType,
    ...(draft.targetWeightKg === undefined ? {} : { targetWeightKg: draft.targetWeightKg }),
    ...(keepsWeeklyRate ? { weeklyRateKg: draft.weeklyRateKg } : {}),
    activityLevel,
    trainingDaysPerWeek,
    ...(draft.sportProfile === undefined ? {} : { sportProfile: draft.sportProfile }),
    dietType,
    allergies: [...draft.allergies],
    dislikes: [...draft.dislikes],
    calorieMode: draft.calorieMode,
    onboardingCompleted: true,
  };
}

/** Variante non levante, pour prévisualiser les chiffres en cours de saisie. */
export function tryBuildUserProfile(draft: ProfileDraft): UserProfile | undefined {
  return isDraftComplete(draft) ? buildUserProfile(draft) : undefined;
}
