import { act, fireEvent, waitFor } from '@testing-library/react-native';

import FoodSearchScreen from '@/app/food/search';
import type { FoodItem } from '@/domain/food/types';
import { SEARCH_DEBOUNCE_MS } from '@/hooks/use-food-catalog';

import { buildFoodItem } from '../integration/helpers/fixtures';
import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock, setLocalSearchParams } from '../support/router-mock';

/** Produit distant : identifiant préfixé `off:`, jamais « vérifié ». */
function buildRemoteItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return buildFoodItem({
    id: 'off:3017620422003',
    source: 'off',
    name: 'Pâte à tartiner distante',
    verified: false,
    ...overrides,
  });
}

/**
 * Recherche d'aliments.
 *
 * Le fil conducteur de ces tests : **le cache local répond toujours**. Le
 * réseau ne fait qu'ajouter. Une panne retire des résultats supplémentaires,
 * elle ne vide jamais l'écran et ne bloque jamais la saisie
 * (PHASES_2_A_5 §4.7).
 */
describe('recherche d’aliments', () => {
  let harness: AppHarness;

  beforeEach(() => {
    jest.useFakeTimers();
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
    jest.useRealTimers();
  });

  /** Laisse passer le délai de debounce et les promesses qu'il déclenche. */
  async function settleDebounce() {
    await act(async () => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 50);
    });
  }

  it('n’appelle rien tant que la requête est trop courte', async () => {
    const screen = await harness.renderScreen(<FoodSearchScreen />);

    await fireEvent.changeText(screen.getByTestId('search-input'), 'ri');
    await settleDebounce();

    expect(screen.getByTestId('search-hint')).toBeTruthy();
    expect(harness.foodSource.calls.search).toBe(0);
  });

  it('ne lance qu’une recherche pour une saisie au fil de la frappe', async () => {
    // Sans debounce, taper « nutella » enverrait cinq requêtes — et le quota
    // Open Food Facts se compte par minute (PHASES_2_A_5 §4.2).
    harness.foodSource.setSearchResults([buildRemoteItem()]);
    const screen = await harness.renderScreen(<FoodSearchScreen />);
    const input = screen.getByTestId('search-input');

    for (const value of ['nut', 'nute', 'nutel', 'nutell', 'nutella']) {
      await fireEvent.changeText(input, value);
      await act(async () => {
        jest.advanceTimersByTime(50);
      });
    }

    await settleDebounce();

    expect(harness.foodSource.calls.search).toBe(1);
  });

  it('affiche le cache local immédiatement, sans attendre le réseau', async () => {
    // Le local n'est pas retardé : il est synchrone et gratuit.
    harness.repositories.food.createCustom({
      name: 'Riz basmati maison',
      nutritionPer100: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
    });
    harness.foodSource.hang();

    const screen = await harness.renderScreen(<FoodSearchScreen />);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'riz');

    expect(screen.getByTestId('search-cached')).toBeTruthy();
    expect(screen.getByText('Riz basmati maison')).toBeTruthy();
  });

  it('met en cache tout produit rapporté par la recherche', async () => {
    // « Cache local systématique de tout produit consulté » — c'est ce qui rend
    // la recherche d'aujourd'hui disponible hors ligne demain.
    harness.foodSource.setSearchResults([buildRemoteItem()]);
    const screen = await harness.renderScreen(<FoodSearchScreen />);

    await fireEvent.changeText(screen.getByTestId('search-input'), 'tartiner');
    await settleDebounce();

    await waitFor(() => {
      expect(harness.repositories.food.getById('off:3017620422003')).toBeDefined();
    });
  });

  it('ne montre pas deux fois un produit déjà en cache', async () => {
    const cached = harness.repositories.food.upsert(buildRemoteItem({ name: 'Déjà connu' }));
    harness.foodSource.setSearchResults([cached]);

    const screen = await harness.renderScreen(<FoodSearchScreen />);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'connu');
    await settleDebounce();

    expect(screen.getAllByTestId(`search-result-${cached.id}`)).toHaveLength(1);
  });

  it('affiche l’attribution dès qu’un résultat vient d’Open Food Facts', async () => {
    harness.foodSource.setSearchResults([buildRemoteItem()]);
    const screen = await harness.renderScreen(<FoodSearchScreen />);

    await fireEvent.changeText(screen.getByTestId('search-input'), 'tartiner');
    await settleDebounce();

    await waitFor(() => {
      expect(screen.getByTestId('search-remote')).toHaveTextContent(/Open Food Facts/);
    });
  });

  describe('hors ligne', () => {
    it('garde les résultats locaux et explique la panne', async () => {
      harness.repositories.food.createCustom({
        name: 'Riz basmati maison',
        nutritionPer100: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
      });
      harness.foodSource.goOffline();

      const screen = await harness.renderScreen(<FoodSearchScreen />);
      await fireEvent.changeText(screen.getByTestId('search-input'), 'riz');
      await settleDebounce();

      await waitFor(() => {
        expect(screen.getByTestId('search-error')).toBeTruthy();
      });

      // L'écran n'est ni vide ni bloqué : le cache local est toujours là.
      expect(screen.getByText('Riz basmati maison')).toBeTruthy();
      expect(screen.queryByTestId('search-loading')).toBeNull();
    });

    it('propose la saisie manuelle comme repli', async () => {
      harness.foodSource.goOffline();

      const screen = await harness.renderScreen(<FoodSearchScreen />);
      await fireEvent.changeText(screen.getByTestId('search-input'), 'inconnu');
      await settleDebounce();

      await waitFor(() => {
        expect(screen.getByTestId('source-manual-entry')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('source-manual-entry'));

      expect(routerMock.push).toHaveBeenCalledWith('/food/custom');
    });

    it('ne reste jamais sur un indicateur de chargement éternel', async () => {
      // Le réseau qui pend est le pire cas : la requête ne revient jamais.
      // L'écran doit rester utilisable — saisie, cache, repli manuel.
      harness.foodSource.hang();

      const screen = await harness.renderScreen(<FoodSearchScreen />);
      await fireEvent.changeText(screen.getByTestId('search-input'), 'quelque chose');
      await settleDebounce();

      expect(screen.getByTestId('search-loading')).toBeTruthy();
      // Rien n'est bloqué : les deux issues restent atteignables.
      expect(screen.getByTestId('search-manual')).toBeTruthy();
      expect(screen.getByTestId('search-scan')).toBeTruthy();
    });
  });

  it('propose la saisie quand rien ne correspond', async () => {
    harness.foodSource.setSearchResults([]);

    const screen = await harness.renderScreen(<FoodSearchScreen />);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'zzzzz');
    await settleDebounce();

    await waitFor(() => {
      expect(screen.getByTestId('search-empty')).toBeTruthy();
    });
  });

  it('emmène le repas choisi jusqu’à l’écran d’ajout', async () => {
    // Le détour par la recherche ne doit pas faire oublier ce que la personne
    // était en train de faire : elle ajoutait quelque chose à son dîner.
    setLocalSearchParams({ mealType: 'dinner' });

    const cached = harness.repositories.food.upsert(buildRemoteItem({ name: 'Produit connu' }));
    const screen = await harness.renderScreen(<FoodSearchScreen />);

    await fireEvent.changeText(screen.getByTestId('search-input'), 'connu');
    await fireEvent.press(screen.getByTestId(`search-result-${cached.id}`));

    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/food/add',
      params: { foodItemId: cached.id, mealType: 'dinner' },
    });
  });
});
