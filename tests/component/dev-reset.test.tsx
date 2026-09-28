import { fireEvent, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import WelcomeScreen from '@/app/(onboarding)/welcome';
import RootScreen from '@/app/index';
import { useDevDataReset } from '@/hooks/use-dev-reset';
import { RepositoriesProvider } from '@/hooks/use-repositories';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSessionStore } from '@/stores/session';

import { buildStoredProfile } from '../integration/helpers/fixtures';
import { countRowsByTable } from '../integration/helpers/test-db';
import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock } from '../support/router-mock';

/**
 * Le panneau de debug est un outil de développement, mais son câblage est celui
 * d'un écran ordinaire : il passe par `useRepositories`, jamais par du SQL.
 * Ces tests vérifient donc la chaîne complète — appui, effacement, retour à
 * l'onboarding — sur de vrais repositories adossés à une base en mémoire.
 */
describe('panneau de développement', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    harness.repositories.profile.save(buildStoredProfile());
    useSessionStore.getState().setDatabaseReady(true);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('est accessible depuis l’écran du jour', async () => {
    const screen = await harness.renderScreen(<RootScreen />);

    expect(screen.getByTestId('dev-panel')).toBeTruthy();
    expect(screen.getByText('Réinitialiser les données (dev)')).toBeTruthy();
  });

  it('est aussi accessible depuis l’onboarding, où le consentement est déjà persisté', async () => {
    const screen = await harness.renderScreen(<WelcomeScreen />);

    expect(screen.getByTestId('dev-reset')).toBeTruthy();
  });

  it('n’efface rien au premier appui : il demande confirmation', async () => {
    const screen = await harness.renderScreen(<RootScreen />);

    await fireEvent.press(screen.getByTestId('dev-reset'));

    expect(screen.getByTestId('dev-reset-warning')).toBeTruthy();
    expect(harness.repositories.profile.get()).toBeDefined();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('renonce sans rien toucher quand on annule', async () => {
    const screen = await harness.renderScreen(<RootScreen />);

    await fireEvent.press(screen.getByTestId('dev-reset'));
    await fireEvent.press(screen.getByTestId('dev-reset-cancel'));

    expect(screen.queryByTestId('dev-reset-warning')).toBeNull();
    expect(harness.repositories.profile.hasCompletedOnboarding()).toBe(true);
  });

  it('vide toutes les tables locales une fois confirmé', async () => {
    const screen = await harness.renderScreen(<RootScreen />);

    await fireEvent.press(screen.getByTestId('dev-reset'));
    await fireEvent.press(screen.getByTestId('dev-reset'));

    const remaining = Object.entries(countRowsByTable(harness.database)).filter(
      ([, total]) => total > 0,
    );

    expect(remaining).toEqual([]);
  });

  it('renvoie sur l’onboarding, comme au premier lancement', async () => {
    const screen = await harness.renderScreen(<RootScreen />);

    await fireEvent.press(screen.getByTestId('dev-reset'));
    await fireEvent.press(screen.getByTestId('dev-reset'));

    // L'écran monté se rerend de lui-même : l'onboarding n'est plus terminé.
    expect(screen.getByTestId('redirect').props.children).toBe('/(onboarding)/welcome');
    expect(harness.repositories.profile.hasCompletedOnboarding()).toBe(false);
    expect(harness.repositories.consent.hasGranted(PRIVACY_POLICY_VERSION)).toBe(false);
    // La navigation repasse par l'aiguillage racine, pas directement par
    // l'onboarding : exactement le chemin d'une première ouverture.
    expect(routerMock.replace).toHaveBeenCalledWith('/');
  });

  it('remet aussi l’état mémoire à zéro, sans prétendre que la base est absente', async () => {
    useSessionStore.getState().setSelectedDate('2020-01-01');
    useSessionStore.getState().toggleMealType('snack');
    useOnboardingStore.getState().update({ currentWeightKg: 91 });

    const screen = await harness.renderScreen(<RootScreen />);
    await fireEvent.press(screen.getByTestId('dev-reset'));
    await fireEvent.press(screen.getByTestId('dev-reset'));

    const session = useSessionStore.getState();
    expect(session.selectedDate).not.toBe('2020-01-01');
    expect(session.expandedMealType).toBeUndefined();
    expect(useOnboardingStore.getState().draft.currentWeightKg).toBeUndefined();
    // Les migrations restent appliquées : seules les lignes ont disparu.
    expect(session.databaseReady).toBe(true);
  });

  it('force une relecture du profil même quand aucune écriture n’a précédé', async () => {
    // `profileRevision` vaut 0 au montage : un simple `reset()` du store le
    // laisserait à 0, aucun écran ne se rerendrait, et l'utilisateur resterait
    // sur un tableau du jour alimenté par un profil qui n'existe plus.
    expect(useSessionStore.getState().profileRevision).toBe(0);

    const screen = await harness.renderScreen(<RootScreen />);
    await fireEvent.press(screen.getByTestId('dev-reset'));
    await fireEvent.press(screen.getByTestId('dev-reset'));

    expect(useSessionStore.getState().profileRevision).not.toBe(0);
    expect(screen.getByTestId('redirect')).toBeTruthy();
  });
});

/**
 * La promesse tenue par le panneau n'est pas « discret en production » mais
 * « absent ». Ces deux tests la vérifient des deux côtés : rien à voir, et rien
 * à déclencher même en atteignant le hook directement.
 */
describe('panneau de développement, hors développement', () => {
  let harness: AppHarness;
  const originalDev = __DEV__;

  beforeEach(() => {
    harness = createAppHarness();
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    harness.repositories.profile.save(buildStoredProfile());
    useSessionStore.getState().setDatabaseReady(true);
  });

  afterEach(() => {
    setDev(originalDev);
    harness.cleanup();
  });

  it('ne rend rien du tout, l’écran reste celui de l’utilisateur', async () => {
    setDev(false);

    const screen = await harness.renderScreen(<RootScreen />);

    expect(screen.queryByTestId('dev-panel')).toBeNull();
    expect(screen.queryByTestId('dev-reset')).toBeNull();
    expect(screen.queryByText('Réinitialiser les données (dev)')).toBeNull();
    expect(screen.getByTestId('today-budget')).toBeTruthy();
  });

  it('refuse d’effacer quoi que ce soit même si le hook est atteint directement', async () => {
    // `renderHook` est asynchrone depuis React Native Testing Library v14.
    const { result } = await renderHook(() => useDevDataReset(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <RepositoriesProvider value={harness.repositories}>{children}</RepositoriesProvider>
      ),
    });

    setDev(false);

    expect(() => result.current()).toThrow(/réservé au développement/);
    expect(harness.repositories.profile.hasCompletedOnboarding()).toBe(true);
  });
});

/** `__DEV__` est une globale injectée par Metro, pas une variable de module. */
function setDev(value: boolean): void {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
}
