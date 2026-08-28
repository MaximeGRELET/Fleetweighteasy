import { useCallback } from 'react';

import { buildUserProfile, type ProfileDraft } from '@/domain/profile/draft';
import type { UserProfile } from '@/domain/profile/types';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSessionStore } from '@/stores/session';

import { useProfileInvalidation } from './use-profile';
import { useRepositories } from './use-repositories';

export interface OnboardingController {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  /** Consentement explicite aux données de santé, horodaté et persisté. */
  grantConsent: () => void;
  /** Vrai si le consentement en base couvre la version courante de la politique. */
  hasConsented: boolean;
  /** Persiste le profil et clôt l'onboarding. */
  complete: () => UserProfile;
}

export function useOnboarding(): OnboardingController {
  const repositories = useRepositories();
  const draft = useOnboardingStore((state) => state.draft);
  const update = useOnboardingStore((state) => state.update);
  const resetDraft = useOnboardingStore((state) => state.reset);
  const bumpProfileRevision = useSessionStore((state) => state.bumpProfileRevision);
  // Abonnement au jeton d'invalidation : re-rend après `grantConsent`, donc
  // relit le consentement ci-dessous.
  useProfileInvalidation();

  const grantConsent = useCallback(() => {
    repositories.consent.grant(PRIVACY_POLICY_VERSION);
    bumpProfileRevision();
  }, [repositories, bumpProfileRevision]);

  const complete = useCallback(() => {
    const profile = buildUserProfile(draft);
    repositories.profile.save(profile);
    resetDraft();
    bumpProfileRevision();
    return profile;
  }, [draft, repositories, resetDraft, bumpProfileRevision]);

  const hasConsented = repositories.consent.hasGranted(PRIVACY_POLICY_VERSION);

  return { draft, update, grantConsent, hasConsented, complete };
}
