import { create } from 'zustand';

import type { MealType } from '@/domain/journal/types';

/**
 * État de session : ce qui concerne l'affichage courant, pas la donnée.
 *
 * Règle de partage avec la couche data : tout ce qui doit survivre à la
 * fermeture de l'app vit en SQLite (repositories). Ici, uniquement de l'état
 * d'interface volatil — aucune donnée de journal, aucune donnée de santé,
 * aucune logique métier.
 */
export interface SessionState {
  /** Jour affiché dans le journal, au format `YYYY-MM-DD`. */
  selectedDate: string;
  /** Repas déplié dans le journal, s'il y en a un. */
  expandedMealType?: MealType;
  /** Vrai tant que les migrations SQLite n'ont pas abouti. */
  databaseReady: boolean;
  /**
   * Jeton d'invalidation, incrémenté à chaque écriture du profil.
   *
   * Ce n'est pas une donnée : c'est ce qui dit aux écrans de relire le profil
   * en base. Tant que TanStack Query n'est pas branché (Phase 4), il tient lieu
   * d'invalidation de cache — sans jamais dupliquer la donnée hors de SQLite.
   */
  profileRevision: number;
  /**
   * Jeton d'invalidation du contenu du jour : journal, séances, repas
   * prédéfinis et cache d'aliments.
   *
   * Même rôle que `profileRevision`, sur un autre périmètre. Un seul jeton pour
   * ces quatre-là, et non un par table : ils changent presque toujours ensemble
   * — ajouter une entrée de journal met aussi à jour le cache de l'aliment — et
   * une granularité plus fine coûterait en complexité ce qu'elle ferait gagner
   * en rendus évités, c'est-à-dire rien à cette échelle.
   */
  journalRevision: number;

  setSelectedDate: (date: string) => void;
  toggleMealType: (mealType: MealType) => void;
  setDatabaseReady: (ready: boolean) => void;
  bumpProfileRevision: () => void;
  bumpJournalRevision: () => void;
  reset: () => void;
}

/** Date du jour au format `YYYY-MM-DD`, dans le fuseau local de l'appareil. */
export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const initialState = {
  selectedDate: todayIsoDate(),
  expandedMealType: undefined,
  databaseReady: false,
  profileRevision: 0,
  journalRevision: 0,
} satisfies Omit<
  SessionState,
  | 'setSelectedDate'
  | 'toggleMealType'
  | 'setDatabaseReady'
  | 'bumpProfileRevision'
  | 'bumpJournalRevision'
  | 'reset'
>;

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSelectedDate: (selectedDate) => set({ selectedDate }),

  toggleMealType: (mealType) =>
    set((state) => ({
      expandedMealType: state.expandedMealType === mealType ? undefined : mealType,
    })),

  setDatabaseReady: (databaseReady) => set({ databaseReady }),

  bumpProfileRevision: () => set((state) => ({ profileRevision: state.profileRevision + 1 })),

  bumpJournalRevision: () => set((state) => ({ journalRevision: state.journalRevision + 1 })),

  reset: () => set({ ...initialState, selectedDate: todayIsoDate() }),
}));
