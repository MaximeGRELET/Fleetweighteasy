import { create } from 'zustand';

import type { FoodDraft } from '@/data/remote';
import type { MealType } from '@/domain/journal/types';

/**
 * Brouillon d'aliment maison, en mémoire seulement.
 *
 * Sert de passage de relais entre deux écrans : un scan qui tombe sur une fiche
 * incomplète, ou sur rien du tout, ouvre le formulaire de saisie déjà rempli de
 * ce qu'on savait. Le faire transiter par l'URL obligerait à sérialiser des
 * nutriments en paramètres de route — illisible, et fragile au premier champ
 * ajouté.
 *
 * Rien n'est persisté : tant que l'utilisateur n'a pas validé, aucun aliment
 * n'existe. Même principe que le brouillon d'onboarding.
 */
export interface FoodDraftState {
  /** Valeurs connues à pré-remplir, s'il y en a. */
  draft?: FoodDraft;
  /**
   * Repas auquel rattacher l'aliment une fois créé.
   *
   * Mémorisé ici parce que le détour par la saisie manuelle ne doit pas faire
   * oublier ce que l'utilisateur était en train de faire : il ajoutait quelque
   * chose à son déjeuner.
   */
  pendingMealType?: MealType;

  /** Ouvre le formulaire pré-rempli à partir d'une fiche incomplète. */
  startFrom: (draft: FoodDraft, mealType?: MealType) => void;
  /** Ouvre le formulaire vierge, éventuellement avec un code-barres connu. */
  startBlank: (options?: { barcode?: string; mealType?: MealType }) => void;
  clear: () => void;
}

export const useFoodDraftStore = create<FoodDraftState>((set) => ({
  draft: undefined,
  pendingMealType: undefined,

  startFrom: (draft, mealType) =>
    set({ draft, ...(mealType === undefined ? {} : { pendingMealType: mealType }) }),

  startBlank: (options = {}) =>
    set({
      draft: {
        name: '',
        ...(options.barcode === undefined ? {} : { barcode: options.barcode }),
        nutritionPer100: {},
        servingSizes: [],
      },
      ...(options.mealType === undefined ? {} : { pendingMealType: options.mealType }),
    }),

  clear: () => set({ draft: undefined, pendingMealType: undefined }),
}));
