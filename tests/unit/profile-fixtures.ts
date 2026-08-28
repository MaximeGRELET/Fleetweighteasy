import type { UserProfile } from '@/domain/profile/types';

/** Instant de référence figé : les tests du domaine doivent rester déterministes. */
export const NOW = new Date('2026-08-27T00:00:00Z');

/** Date de naissance donnant l'âge voulu à `NOW`. */
export function birthDateForAge(ageYears: number): string {
  return `${NOW.getUTCFullYear() - ageYears}-01-15`;
}

const BASE_PROFILE: UserProfile = {
  sex: 'male',
  birthDate: birthDateForAge(30),
  heightCm: 180,
  currentWeightKg: 80,
  goalType: 'weight_loss',
  activityLevel: 'moderately_active',
  trainingDaysPerWeek: 3,
  dietType: 'omnivore',
  allergies: [],
  dislikes: [],
  calorieMode: 'fixed',
  onboardingCompleted: true,
};

export function buildProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return { ...BASE_PROFILE, ...overrides };
}
