import { useMemo } from 'react';

import { createAppFoodDataSource, type FoodCatalogSource } from '@/data/remote';

/**
 * Construit la source alimentaire de l'application.
 *
 * Pendant du `useAppRepositories`, et pour la même raison : `src/app/**` ne peut
 * pas importer `@/data` (règle vérifiée par ESLint), c'est ce hook qui fait le
 * pont. À n'appeler **qu'une fois**, par le layout racine — une source par
 * écran multiplierait les limiteurs de débit, et donc le quota consommé.
 */
export function useAppFoodSource(): FoodCatalogSource {
  return useMemo(() => createAppFoodDataSource(), []);
}
