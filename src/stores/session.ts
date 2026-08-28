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

  setSelectedDate: (date: string) => void;
  toggleMealType: (mealType: MealType) => void;
  setDatabaseReady: (ready: boolean) => void;
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
} satisfies Omit<SessionState, 'setSelectedDate' | 'toggleMealType' | 'setDatabaseReady' | 'reset'>;

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSelectedDate: (selectedDate) => set({ selectedDate }),

  toggleMealType: (mealType) =>
    set((state) => ({
      expandedMealType: state.expandedMealType === mealType ? undefined : mealType,
    })),

  setDatabaseReady: (databaseReady) => set({ databaseReady }),

  reset: () => set({ ...initialState, selectedDate: todayIsoDate() }),
}));
