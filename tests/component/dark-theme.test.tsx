import * as ReactNative from 'react-native';

import AdviceScreen from '@/app/advice/index';
import RootScreen from '@/app/index';
import WeightScreen from '@/app/weight/index';
import { darkColors, lightColors } from '@/theme';

import { buildStoredProfile } from '../integration/helpers/fixtures';
import { createAppHarness, type AppHarness } from '../support/render-with-app';

/**
 * Rendu en thème sombre.
 *
 * Ne remplace pas le contrôle visuel sur appareil — le contraste et la
 * lisibilité se jugent à l'œil. Mais une couleur codée en dur ne se voit pas
 * toujours en relisant, et se remarque surtout chez l'utilisateur : ces tests
 * vérifient que les écrans prennent bien leurs couleurs dans la palette
 * sombre, et qu'aucune valeur claire ne subsiste dans leurs fonds.
 */
describe('thème sombre', () => {
  let harness: AppHarness;
  let colorScheme: jest.SpyInstance;

  beforeEach(() => {
    colorScheme = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    harness = createAppHarness();
    harness.repositories.profile.save(buildStoredProfile());
  });

  afterEach(() => {
    colorScheme.mockRestore();
    harness.cleanup();
  });

  /** Fonds appliqués par un écran, tous niveaux confondus. */
  function backgroundColors(json: unknown): string[] {
    const found: string[] = [];

    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }

      if (!node || typeof node !== 'object') {
        return;
      }

      const record = node as Record<string, unknown>;

      if (typeof record.backgroundColor === 'string') {
        found.push(record.backgroundColor);
      }

      Object.values(record).forEach(walk);
    };

    walk(json);
    return found;
  }

  const LIGHT_SURFACES = [lightColors.background, lightColors.surface, lightColors.surfaceMuted];

  it('peint le tableau du jour avec la palette sombre', async () => {
    const screen = await harness.renderScreen(<RootScreen />);
    const backgrounds = backgroundColors(screen.toJSON());

    expect(backgrounds).toContain(darkColors.background);
    // Aucun fond clair ne doit subsister : ce serait une couleur figée.
    expect(backgrounds.filter((color) => LIGHT_SURFACES.includes(color))).toEqual([]);
  });

  it('peint la section conseils avec la palette sombre', async () => {
    const screen = await harness.renderScreen(<AdviceScreen />);
    const backgrounds = backgroundColors(screen.toJSON());

    expect(backgrounds).toContain(darkColors.background);
    expect(backgrounds).toContain(darkColors.surface);
    expect(backgrounds.filter((color) => LIGHT_SURFACES.includes(color))).toEqual([]);
  });

  it('peint le suivi du poids avec la palette sombre', async () => {
    const screen = await harness.renderScreen(<WeightScreen />);
    const backgrounds = backgroundColors(screen.toJSON());

    expect(backgrounds).toContain(darkColors.background);
    expect(backgrounds.filter((color) => LIGHT_SURFACES.includes(color))).toEqual([]);
  });

  it('bascule réellement avec le réglage système', async () => {
    colorScheme.mockReturnValue('light');
    const light = await harness.renderScreen(<AdviceScreen />);
    const lightBackgrounds = backgroundColors(light.toJSON());

    expect(lightBackgrounds).toContain(lightColors.background);
    expect(lightBackgrounds).not.toContain(darkColors.background);
  });
});
