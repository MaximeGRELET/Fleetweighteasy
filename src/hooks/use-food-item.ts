import { useMemo } from 'react';

import type { FoodItem } from '@/domain/food/types';
import { useSessionStore } from '@/stores/session';

import { useRepositories } from './use-repositories';

/**
 * Lecture d'un aliment du cache local.
 *
 * Toujours local, jamais distant : au moment où un écran a besoin d'un aliment
 * par son identifiant, il a forcément déjà été consulté — donc mis en cache
 * (`use-food-catalog`). Le rechercher sur le réseau consommerait du quota pour
 * une donnée qu'on possède, et rendrait dépendant du réseau un écran qui n'a
 * aucune raison de l'être.
 */
export function useStoredFoodItem(id: string | undefined): FoodItem | undefined {
  const repositories = useRepositories();
  const journalRevision = useSessionStore((state) => state.journalRevision);

  return useMemo(
    () => (id === undefined ? undefined : repositories.food.getById(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repositories, id, journalRevision],
  );
}
