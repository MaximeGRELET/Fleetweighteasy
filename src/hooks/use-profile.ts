import { useMemo } from 'react';

import { calculateCalorieTarget, type CalorieTargetResult } from '@/domain/nutrition/energy';
import { calculateMacros, type MacroResult } from '@/domain/nutrition/macros';
import type { UserProfile } from '@/domain/profile/types';
import { useSessionStore } from '@/stores/session';

import { useRepositories } from './use-repositories';

/**
 * Lecture du profil persisté.
 *
 * Les repositories sont synchrones (SQLite) : la lecture se fait à chaque rendu
 * plutôt que dans un cache mémoire, pour qu'aucune valeur périmée ne circule.
 * L'abonnement à `profileRevision` provoque le nouveau rendu après une écriture.
 * Un vrai cache viendra avec TanStack Query (Phase 4).
 */
export function useStoredProfile(): UserProfile | undefined {
  const repositories = useRepositories();
  useProfileInvalidation();

  return repositories.profile.get();
}

export function useHasCompletedOnboarding(): boolean {
  const repositories = useRepositories();
  useProfileInvalidation();

  return repositories.profile.hasCompletedOnboarding();
}

/**
 * S'abonne au jeton d'invalidation du profil.
 *
 * Ne renvoie rien volontairement : seule compte la souscription, qui déclenche
 * un nouveau rendu — et donc une relecture — à chaque écriture du profil.
 */
export function useProfileInvalidation(): void {
  useSessionStore((state) => state.profileRevision);
}

export interface CaloriePlan {
  target: CalorieTargetResult;
  macros: MacroResult;
}

/**
 * Objectif calorique et macros, **recalculés** depuis le profil.
 *
 * Jamais lus en base : le profil est la seule source de vérité, les chiffres en
 * découlent (PHASE_2 §2.4). Changer de poids change les chiffres, sans migration
 * ni donnée périmée.
 */
export function useCaloriePlan(profile: UserProfile | undefined): CaloriePlan | undefined {
  return useMemo(() => (profile ? buildCaloriePlan(profile) : undefined), [profile]);
}

/** Version pure, réutilisable hors React (tests, restitution d'onboarding). */
export function buildCaloriePlan(profile: UserProfile, now: Date = new Date()): CaloriePlan {
  const target = calculateCalorieTarget(profile, now);

  return {
    target,
    macros: calculateMacros({
      targetKcal: target.targetKcal,
      weightKg: profile.currentWeightKg,
      goalType: profile.goalType,
    }),
  };
}
