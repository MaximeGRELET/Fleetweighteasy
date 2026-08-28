import { useMemo } from 'react';

import { createAppRepositories } from '@/data/repositories';
import type { Repositories } from '@/data/repositories/factory';

/**
 * Construit les repositories de l'application.
 *
 * À n'appeler **qu'une fois**, par le layout racine, et seulement après que les
 * migrations ont abouti. Ce hook est le point de passage prévu entre l'UI et la
 * couche data : c'est pour cela qu'il vit ici et non dans un écran.
 */
export function useAppRepositories(): Repositories {
  return useMemo(() => createAppRepositories(), []);
}
