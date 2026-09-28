import { QueryClientProvider } from '@tanstack/react-query';
import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingLayout from '@/app/(onboarding)/_layout';
import ActivityScreen from '@/app/(onboarding)/activity';
import BiometricsScreen from '@/app/(onboarding)/biometrics';
import CalorieModeScreen from '@/app/(onboarding)/calorie-mode';
import ConsentScreen from '@/app/(onboarding)/consent';
import DietScreen from '@/app/(onboarding)/diet';
import GoalScreen from '@/app/(onboarding)/goal';
import RateScreen from '@/app/(onboarding)/rate';
import SummaryScreen from '@/app/(onboarding)/summary';
import TargetWeightScreen from '@/app/(onboarding)/target-weight';
import TrainingScreen from '@/app/(onboarding)/sport-habits';
import WelcomeScreen from '@/app/(onboarding)/welcome';
import LocalDataScreen from '@/app/data/index';
import SportScreen from '@/app/training/index';
import RootScreen from '@/app/index';
import { FoodSourceProvider } from '@/hooks/use-food-source';
import { RepositoriesProvider } from '@/hooks/use-repositories';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';
import { useOnboardingStore } from '@/stores/onboarding';

import { buildStoredProfile } from '../integration/helpers/fixtures';
import { createAppHarness, type AppHarness } from '../support/render-with-app';

/**
 * Navigation, avec le **vrai** routeur d'Expo Router.
 *
 * Les autres tests d'écran remplacent le routeur par un espion : ils vérifient
 * qu'un écran *demande* d'aller quelque part, pas où il arrive. C'est ce trou
 * qui a laissé passer #30 — deux écrans à l'URL `/`, et la fin de l'onboarding
 * qui ramenait à son propre début. Ici, les écrans sont montés dans une vraie
 * pile, et on vérifie ce qui s'affiche.
 */
jest.unmock('expo-router');

const ONBOARDING_STEPS = [
  'goal',
  'biometrics',
  'target-weight',
  'rate',
  'activity',
  'sport-habits',
  'diet',
  'summary',
  'calorie-mode',
] as const;

describe('navigation', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  function RootLayout() {
    return (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <QueryClientProvider client={harness.queryClient}>
          <RepositoriesProvider value={harness.repositories}>
            <FoodSourceProvider value={harness.foodSource}>
              <Stack screenOptions={{ headerShown: false }} />
            </FoodSourceProvider>
          </RepositoriesProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  /** Les routes utiles ici, montées sous leurs vrais chemins de fichiers. */
  async function openApp() {
    await renderRouter(
      {
        _layout: RootLayout,
        index: RootScreen,
        'data/index': LocalDataScreen,
        'training/index': SportScreen,
        '(onboarding)/_layout': OnboardingLayout,
        '(onboarding)/welcome': WelcomeScreen,
        '(onboarding)/consent': ConsentScreen,
        '(onboarding)/goal': GoalScreen,
        '(onboarding)/biometrics': BiometricsScreen,
        '(onboarding)/target-weight': TargetWeightScreen,
        '(onboarding)/rate': RateScreen,
        '(onboarding)/activity': ActivityScreen,
        '(onboarding)/sport-habits': TrainingScreen,
        '(onboarding)/diet': DietScreen,
        '(onboarding)/summary': SummaryScreen,
        '(onboarding)/calorie-mode': CalorieModeScreen,
      },
      { initialUrl: '/' },
    );
  }

  async function navigate(href: string) {
    await act(async () => {
      router.push(href as never);
    });
  }

  it('ouvre l’accueil de l’onboarding au premier lancement', async () => {
    await openApp();

    expect(screen.getByTestId('onboarding-welcome')).toBeTruthy();
  });

  it('ouvre directement le tableau du jour quand l’onboarding est terminé', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    harness.repositories.profile.save(buildStoredProfile());

    await openApp();

    expect(screen.getByTestId('today-budget')).toBeTruthy();
  });

  /** #30 : « Terminer » ramenait à l'accueil de l'onboarding, brouillon vidé. */
  it('mène au tableau du jour après « Terminer », pas au début de l’onboarding', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    useOnboardingStore.getState().update({
      goalType: 'weight_loss',
      sex: 'male',
      birthDate: '1996-01-15',
      heightCm: 180,
      currentWeightKg: 80,
      targetWeightKg: 75,
      weeklyRateKg: 0.5,
      activityLevel: 'moderately_active',
      trainingDaysPerWeek: 3,
      dietType: 'omnivore',
    });
    await openApp();

    // Même pile que sur le téléphone : les écrans précédents restent montés.
    for (const step of ONBOARDING_STEPS) {
      await navigate(`/(onboarding)/${step}`);
    }
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(harness.repositories.profile.hasCompletedOnboarding()).toBe(true);
    expect(screen.getByTestId('today-budget')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-welcome')).toBeNull();
  });

  it('ouvre l’écran sport depuis le tableau du jour, pas une étape de l’onboarding', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    harness.repositories.profile.save(buildStoredProfile());
    await openApp();

    await fireEvent.press(screen.getByTestId('today-training'));

    expect(screen.getByTestId('training-log-cardio')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-training')).toBeNull();
  });

  it('ramène à l’accueil de l’onboarding après un effacement', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    harness.repositories.profile.save(buildStoredProfile());
    await openApp();
    await navigate('/data');

    await fireEvent.press(screen.getByTestId('data-erase'));
    await fireEvent.press(screen.getByTestId('data-erase'));

    expect(screen.getByTestId('onboarding-welcome')).toBeTruthy();
  });
});

/**
 * Cause racine de #30 : `(onboarding)/index.tsx` et `index.tsx` avaient tous
 * deux l'URL `/`, un groupe entre parenthèses n'ajoutant rien au chemin. Ce
 * test recense les fichiers de `src/app` et refuse que deux écrans partagent
 * une URL — sans dépendre de la mémoire de celui qui ajoutera le prochain.
 */
describe('routes', () => {
  const APP_DIR = join(__dirname, '..', '..', 'src', 'app');

  function listScreens(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        return listScreens(path);
      }
      return /\.tsx?$/.test(entry) && !entry.startsWith('_') ? [path] : [];
    });
  }

  function urlOf(file: string): string {
    const segments = relative(APP_DIR, file)
      .replace(/\.tsx?$/, '')
      .split(sep)
      .filter((segment) => !/^\(.*\)$/.test(segment) && segment !== 'index');

    return `/${segments.join('/')}`;
  }

  it('ne donne jamais la même URL à deux écrans', () => {
    const byUrl = new Map<string, string[]>();
    for (const file of listScreens(APP_DIR)) {
      const url = urlOf(file);
      byUrl.set(url, [...(byUrl.get(url) ?? []), relative(APP_DIR, file)]);
    }

    const collisions = [...byUrl.entries()].filter(([, files]) => files.length > 1);

    expect(collisions).toEqual([]);
  });
});
