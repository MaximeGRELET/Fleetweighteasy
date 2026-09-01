import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createRepositories, type Repositories } from '@/data/repositories/factory';
import type { ProfileDraft } from '@/domain/profile/draft';
import { FoodSourceProvider } from '@/hooks/use-food-source';
import { RepositoriesProvider } from '@/hooks/use-repositories';
import { useFoodDraftStore } from '@/stores/food-draft';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSessionStore } from '@/stores/session';

import { createTestDatabase, type TestDatabase } from '../integration/helpers/test-db';

import { resetCameraMock } from './camera-mock';
import { createFakeFoodSource, type FakeFoodSource } from './fake-food-source';
import { resetRouterMock } from './router-mock';

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** `render` est asynchrone depuis React Native Testing Library v14. */
export type RenderedScreen = Awaited<ReturnType<typeof render>>;

export interface AppHarness {
  repositories: Repositories;
  database: TestDatabase;
  /** Source distante simulée : c'est elle qu'on met hors ligne dans les tests. */
  foodSource: FakeFoodSource;
  queryClient: QueryClient;
  renderScreen: (element: ReactElement) => Promise<RenderedScreen>;
  /** Pré-remplit le brouillon d'onboarding, comme l'auraient fait les écrans précédents. */
  setDraft: (patch: Partial<ProfileDraft>) => void;
  cleanup: () => void;
}

/**
 * Client de requêtes de test.
 *
 * Sans réessais : un test qui éprouve une panne réseau attendrait sinon deux
 * relances avant de voir l'erreur, pour ne rien vérifier de plus. Le
 * comportement de réessai de l'app est éprouvé à part, sur `createAppQueryClient`.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always', gcTime: 0, staleTime: 0 },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}

/**
 * Monte un écran sur de **vrais** repositories, adossés à une base SQLite en
 * mémoire migrée avec les fichiers de production. Ce ne sont donc pas des
 * doublures : ce que le test observe est ce que l'app écrira vraiment.
 *
 * Seule la source distante est simulée — parce qu'aucun test ne doit dépendre
 * d'Open Food Facts, ni de la présence d'un réseau.
 */
export function createAppHarness(): AppHarness {
  const database = createTestDatabase();
  const repositories = createRepositories(database.context);
  const foodSource = createFakeFoodSource();
  const queryClient = createTestQueryClient();

  useOnboardingStore.getState().reset();
  useSessionStore.getState().reset();
  useFoodDraftStore.getState().clear();
  resetRouterMock();
  resetCameraMock();

  return {
    repositories,
    database,
    foodSource,
    queryClient,
    setDraft: (patch) => useOnboardingStore.getState().update(patch),
    renderScreen: (element) =>
      render(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <QueryClientProvider client={queryClient}>
            <RepositoriesProvider value={repositories}>
              <FoodSourceProvider value={foodSource}>{element}</FoodSourceProvider>
            </RepositoriesProvider>
          </QueryClientProvider>
        </SafeAreaProvider>,
      ),
    cleanup: () => {
      queryClient.clear();
      database.close();
    },
  };
}

/**
 * React Native Testing Library normalise les blancs avant de comparer : les
 * espaces insécables produites par les formateurs deviennent des espaces
 * ordinaires. À utiliser pour chercher un nombre formaté dans le rendu.
 */
export function asRenderedText(formatted: string): RegExp {
  return new RegExp(formatted.replace(/\s/g, ' '));
}
