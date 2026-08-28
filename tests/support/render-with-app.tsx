import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createRepositories, type Repositories } from '@/data/repositories/factory';
import type { ProfileDraft } from '@/domain/profile/draft';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSessionStore } from '@/stores/session';
import { RepositoriesProvider } from '@/hooks/use-repositories';

import { createTestDatabase, type TestDatabase } from '../integration/helpers/test-db';

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
  renderScreen: (element: ReactElement) => Promise<RenderedScreen>;
  /** Pré-remplit le brouillon d'onboarding, comme l'auraient fait les écrans précédents. */
  setDraft: (patch: Partial<ProfileDraft>) => void;
  cleanup: () => void;
}

/**
 * Monte un écran sur de **vrais** repositories, adossés à une base SQLite en
 * mémoire migrée avec les fichiers de production. Ce ne sont donc pas des
 * doublures : ce que le test observe est ce que l'app écrira vraiment.
 */
export function createAppHarness(): AppHarness {
  const database = createTestDatabase();
  const repositories = createRepositories(database.context);

  useOnboardingStore.getState().reset();
  useSessionStore.getState().reset();
  resetRouterMock();

  return {
    repositories,
    database,
    setDraft: (patch) => useOnboardingStore.getState().update(patch),
    renderScreen: (element) =>
      render(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <RepositoriesProvider value={repositories}>{element}</RepositoriesProvider>
        </SafeAreaProvider>,
      ),
    cleanup: () => database.close(),
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
