import { create } from 'zustand';

import { EMPTY_PROFILE_DRAFT, type ProfileDraft } from '@/domain/profile/draft';

/**
 * Brouillon de profil pendant l'onboarding.
 *
 * Volontairement **en mémoire seulement** : rien n'est écrit en base tant que
 * l'utilisateur n'a pas validé la restitution. Le parcours garantit par ailleurs
 * qu'aucune donnée biométrique n'entre ici avant que le consentement ait été
 * recueilli et horodaté (Phase 3 §3.4).
 */
export interface OnboardingState {
  draft: ProfileDraft;
  /** Applique une modification partielle : chaque écran ne touche que ses champs. */
  update: (patch: Partial<ProfileDraft>) => void;
  /** Efface le brouillon — appelé dès que le profil est persisté. */
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  draft: EMPTY_PROFILE_DRAFT,

  update: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),

  reset: () => set({ draft: { ...EMPTY_PROFILE_DRAFT, allergies: [], dislikes: [] } }),
}));
