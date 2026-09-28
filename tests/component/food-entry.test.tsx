import { fireEvent } from '@testing-library/react-native';

import AddFoodEntryScreen from '@/app/food/add';
import CustomFoodScreen from '@/app/food/custom';
import { snapshotForFoodItem } from '@/domain/journal/snapshot';
import { formatKcal } from '@/lib/format';
import { useFoodDraftStore } from '@/stores/food-draft';
import { useSessionStore } from '@/stores/session';

import { buildFoodItem, buildStoredProfile } from '../integration/helpers/fixtures';
import { asRenderedText, createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock, setLocalSearchParams } from '../support/router-mock';

const TODAY = '2026-03-15';

describe('ajout d’une entrée au journal', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.repositories.profile.save(buildStoredProfile());
    useSessionStore.getState().setSelectedDate(TODAY);
  });

  afterEach(() => {
    harness.cleanup();
  });

  function givenCachedItem() {
    return harness.repositories.food.upsert(
      buildFoodItem({
        id: 'off:3017620422003',
        source: 'off',
        name: 'Riz basmati cuit',
        nutritionPer100: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
        servingSizes: [{ label: '1 portion', grams: 150 }],
      }),
    );
  }

  it('fige un snapshot conforme à ce que le domaine calcule', async () => {
    // Le snapshot est la donnée la plus sensible de l'app : l'historique en
    // dépend. Il doit venir du domaine, pas d'une multiplication de l'écran.
    const item = givenCachedItem();
    setLocalSearchParams({ foodItemId: item.id, mealType: 'lunch' });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);
    await fireEvent.changeText(screen.getByTestId('add-quantity'), '250');
    await fireEvent.press(screen.getByTestId('add-confirm'));

    const [entry] = harness.repositories.foodLog.getByDate(TODAY);
    expect(entry?.snapshot).toEqual(snapshotForFoodItem(item, 250));
    expect(entry?.quantityG).toBe(250);
    expect(entry?.mealType).toBe('lunch');
  });

  it('montre avant validation exactement ce qui sera enregistré', async () => {
    const item = givenCachedItem();
    setLocalSearchParams({ foodItemId: item.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);
    await fireEvent.changeText(screen.getByTestId('add-quantity'), '200');

    expect(screen.getByTestId('add-preview')).toHaveTextContent(
      asRenderedText(formatKcal(snapshotForFoodItem(item, 200).kcal)),
    );
  });

  it('part de la portion usuelle quand la fiche en donne une', async () => {
    const item = givenCachedItem();
    setLocalSearchParams({ foodItemId: item.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);

    expect(screen.getByTestId('add-quantity').props.value).toBe('150');
  });

  it('propose les portions usuelles en un tap', async () => {
    const item = givenCachedItem();
    setLocalSearchParams({ foodItemId: item.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);
    await fireEvent.changeText(screen.getByTestId('add-quantity'), '100');
    await fireEvent.press(screen.getByTestId('add-serving-150'));

    expect(screen.getByTestId('add-quantity').props.value).toBe('150');
    // Une seule portion correspond à la quantité : choix exclusif.
    expect(screen.getByTestId('add-serving-150').props.accessibilityRole).toBe('radio');
    expect(screen.getByTestId('add-serving-150').props.accessibilityState.selected).toBe(true);
  });

  it('refuse une quantité nulle ou absurde', async () => {
    const item = givenCachedItem();
    setLocalSearchParams({ foodItemId: item.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);
    await fireEvent.changeText(screen.getByTestId('add-quantity'), '0');

    expect(screen.getByTestId('add-confirm').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('add-confirm'));
    expect(harness.repositories.foodLog.getByDate(TODAY)).toEqual([]);
  });

  it('affiche l’indicateur de fiabilité d’une donnée collaborative', async () => {
    const item = givenCachedItem();
    setLocalSearchParams({ foodItemId: item.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);

    expect(screen.getByTestId('add-reliability')).toHaveTextContent('Donnée collaborative');
  });

  it('fonctionne sans réseau : l’aliment vient du cache', async () => {
    const item = givenCachedItem();
    harness.foodSource.goOffline();
    setLocalSearchParams({ foodItemId: item.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);
    await fireEvent.press(screen.getByTestId('add-confirm'));

    expect(harness.repositories.foodLog.getByDate(TODAY)).toHaveLength(1);
    expect(harness.foodSource.calls.lookup).toBe(0);
  });

  it('explique proprement un aliment disparu, sans planter', async () => {
    setLocalSearchParams({ foodItemId: 'off:inexistant' });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);

    expect(screen.getByText(/n’est plus disponible/)).toBeTruthy();
  });
});

describe('correction d’une entrée existante', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.repositories.profile.save(buildStoredProfile());
    useSessionStore.getState().setSelectedDate(TODAY);
  });

  afterEach(() => {
    harness.cleanup();
  });

  /** Une entrée déjà journalisée, comme après un ajout ordinaire. */
  function givenLoggedEntry() {
    const item = harness.repositories.food.upsert(
      buildFoodItem({
        id: 'off:3017620422003',
        source: 'off',
        name: 'Riz basmati cuit',
        nutritionPer100: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
        servingSizes: [],
      }),
    );

    const entry = harness.repositories.foodLog.addEntry({
      date: TODAY,
      mealType: 'lunch',
      foodItemId: item.id,
      quantityG: 200,
      snapshot: snapshotForFoodItem(item, 200),
    });

    return { item, entry };
  }

  it('reprend la quantité et le repas déjà enregistrés', async () => {
    const { entry } = givenLoggedEntry();
    setLocalSearchParams({ entryId: entry.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);

    expect(screen.getByTestId('add-quantity').props.value).toBe('200');
    expect(screen.getByTestId('add-meal-lunch').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('add-confirm')).toHaveTextContent('Enregistrer la correction');
  });

  /** Un seul repas à la fois : les puces s'annoncent en `radio`. */
  it('annonce le repas comme un choix exclusif', async () => {
    const { entry } = givenLoggedEntry();
    setLocalSearchParams({ entryId: entry.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);

    const lunch = screen.getByTestId('add-meal-lunch');
    expect(lunch.props.accessibilityRole).toBe('radio');
    expect(lunch.props.accessibilityState).toEqual({ checked: true, selected: true });
    expect(screen.getByTestId('add-meal-dinner').props.accessibilityState).toEqual({
      checked: false,
      selected: false,
    });
  });

  it('refait le snapshot au lieu de le mettre à l’échelle', async () => {
    // Une règle de trois sur des valeurs déjà arrondies ferait dériver
    // l'historique un peu plus à chaque correction.
    const { item, entry } = givenLoggedEntry();
    setLocalSearchParams({ entryId: entry.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);
    await fireEvent.changeText(screen.getByTestId('add-quantity'), '150');
    await fireEvent.press(screen.getByTestId('add-confirm'));

    const entries = harness.repositories.foodLog.getByDate(TODAY);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.quantityG).toBe(150);
    expect(entries[0]?.snapshot).toEqual(snapshotForFoodItem(item, 150));
  });

  it('permet de déplacer l’entrée vers un autre repas', async () => {
    const { entry } = givenLoggedEntry();
    setLocalSearchParams({ entryId: entry.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);
    await fireEvent.press(screen.getByTestId('add-meal-dinner'));
    await fireEvent.press(screen.getByTestId('add-confirm'));

    expect(harness.repositories.foodLog.getByDate(TODAY)[0]?.mealType).toBe('dinner');
  });

  it('corrige sans réseau', async () => {
    const { entry } = givenLoggedEntry();
    harness.foodSource.goOffline();
    setLocalSearchParams({ entryId: entry.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);
    await fireEvent.changeText(screen.getByTestId('add-quantity'), '90');
    await fireEvent.press(screen.getByTestId('add-confirm'));

    expect(harness.repositories.foodLog.getByDate(TODAY)[0]?.quantityG).toBe(90);
    expect(harness.foodSource.calls.lookup + harness.foodSource.calls.search).toBe(0);
  });

  it('refuse de corriger une entrée dont l’aliment a disparu', async () => {
    // Sans la source, refaire le snapshot reviendrait à inventer des chiffres.
    const { item, entry } = givenLoggedEntry();
    harness.repositories.food.remove(item.id);
    setLocalSearchParams({ entryId: entry.id });

    const screen = await harness.renderScreen(<AddFoodEntryScreen />);

    expect(screen.getByText(/ne peut plus être corrigée/)).toBeTruthy();
    expect(screen.queryByTestId('add-confirm')).toBeNull();
  });
});

describe('saisie d’un aliment maison', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.repositories.profile.save(buildStoredProfile());
    useSessionStore.getState().setSelectedDate(TODAY);
  });

  afterEach(() => {
    harness.cleanup();
  });

  async function fillValues(
    screen: Awaited<ReturnType<AppHarness['renderScreen']>>,
    values: { kcal: string; protein: string; carbs: string; fat: string },
  ) {
    await fireEvent.changeText(screen.getByTestId('custom-kcal'), values.kcal);
    await fireEvent.changeText(screen.getByTestId('custom-protein'), values.protein);
    await fireEvent.changeText(screen.getByTestId('custom-carbs'), values.carbs);
    await fireEvent.changeText(screen.getByTestId('custom-fat'), values.fat);
  }

  it('crée un aliment vérifié, saisi par l’utilisateur', async () => {
    const screen = await harness.renderScreen(<CustomFoodScreen />);

    await fireEvent.changeText(screen.getByTestId('custom-name'), 'Soupe maison');
    await fillValues(screen, { kcal: '80', protein: '3', carbs: '10', fat: '2' });
    await fireEvent.press(screen.getByTestId('custom-submit'));

    const [created] = harness.repositories.food.listCustom();
    expect(created).toMatchObject({
      name: 'Soupe maison',
      source: 'custom',
      verified: true,
      nutritionPer100: { kcal: 80, proteinG: 3, carbsG: 10, fatG: 2 },
    });
  });

  it('exige les quatre valeurs, en disant pourquoi', async () => {
    const screen = await harness.renderScreen(<CustomFoodScreen />);

    await fireEvent.changeText(screen.getByTestId('custom-name'), 'Incomplet');
    await fireEvent.changeText(screen.getByTestId('custom-kcal'), '80');

    expect(screen.getByTestId('custom-missing-hint')).toBeTruthy();
    expect(screen.getByTestId('custom-submit').props.accessibilityState.disabled).toBe(true);
  });

  it('accepte la virgule décimale, comme un clavier français', async () => {
    const screen = await harness.renderScreen(<CustomFoodScreen />);

    await fireEvent.changeText(screen.getByTestId('custom-name'), 'Yaourt');
    await fillValues(screen, { kcal: '61', protein: '3,5', carbs: '4,7', fat: '3,2' });
    await fireEvent.press(screen.getByTestId('custom-submit'));

    expect(harness.repositories.food.listCustom()[0]?.nutritionPer100.proteinG).toBe(3.5);
  });

  it('signale une incohérence énergie/macros sans bloquer', async () => {
    // Les arrondis d'étiquette empêchent toute vérification stricte : on
    // partage un doute, on n'impose pas une règle.
    const screen = await harness.renderScreen(<CustomFoodScreen />);

    await fireEvent.changeText(screen.getByTestId('custom-name'), 'Suspect');
    await fillValues(screen, { kcal: '100', protein: '30', carbs: '40', fat: '20' });

    expect(screen.getByTestId('custom-energy-warning')).toBeTruthy();
    expect(screen.getByTestId('custom-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('ne signale rien quand les chiffres se tiennent', async () => {
    const screen = await harness.renderScreen(<CustomFoodScreen />);

    await fireEvent.changeText(screen.getByTestId('custom-name'), 'Cohérent');
    await fillValues(screen, { kcal: '130', protein: '2.7', carbs: '28', fat: '0.3' });

    expect(screen.queryByTestId('custom-energy-warning')).toBeNull();
  });

  describe('correction d’une fiche collaborative', () => {
    beforeEach(() => {
      useFoodDraftStore.getState().startFrom(
        {
          barcode: '3017620422003',
          name: 'Pâte à tartiner',
          brand: 'Ferrero',
          nutritionPer100: { kcal: 539, proteinG: 6.3, sugarG: 56.3 },
          servingSizes: [{ label: '15 g', grams: 15 }],
        },
        'breakfast',
      );
    });

    it('reprend ce que la source savait déjà', async () => {
      const screen = await harness.renderScreen(<CustomFoodScreen />);

      expect(screen.getByTestId('custom-prefilled')).toBeTruthy();
      expect(screen.getByTestId('custom-name').props.value).toBe('Pâte à tartiner');
      expect(screen.getByTestId('custom-kcal').props.value).toBe('539');
      // Ce qui manquait reste vide : jamais un zéro inventé.
      expect(screen.getByTestId('custom-fat').props.value).toBe('');
    });

    it('crée un aliment distinct au lieu de modifier la ligne Open Food Facts', async () => {
      // Frontière ODbL : la donnée corrigée est celle de l'utilisateur, elle ne
      // se mélange pas à la base collaborative (src/data/remote/licence.ts).
      const offItem = harness.repositories.food.upsert(
        buildFoodItem({
          id: 'off:3017620422003',
          barcode: '3017620422003',
          source: 'off',
          name: 'Pâte à tartiner',
          verified: false,
        }),
      );

      const screen = await harness.renderScreen(<CustomFoodScreen />);
      await fillValues(screen, { kcal: '539', protein: '6.3', carbs: '57.5', fat: '30.9' });
      await fireEvent.press(screen.getByTestId('custom-submit'));

      const stillOff = harness.repositories.food.getById(offItem.id);
      expect(stillOff).toEqual(offItem);

      const [created] = harness.repositories.food.listCustom();
      expect(created?.source).toBe('custom');
      expect(created?.id).not.toBe(offItem.id);
      expect(created?.verified).toBe(true);
    });

    it('conserve les valeurs secondaires connues et le code-barres', async () => {
      const screen = await harness.renderScreen(<CustomFoodScreen />);
      await fillValues(screen, { kcal: '539', protein: '6.3', carbs: '57.5', fat: '30.9' });
      await fireEvent.press(screen.getByTestId('custom-submit'));

      const [created] = harness.repositories.food.listCustom();
      expect(created?.barcode).toBe('3017620422003');
      expect(created?.nutritionPer100.sugarG).toBe(56.3);
      expect(created?.servingSizes).toEqual([{ label: '15 g', grams: 15 }]);
    });

    it('reprend le fil : retour à l’ajout, sur le repas visé', async () => {
      const screen = await harness.renderScreen(<CustomFoodScreen />);
      await fillValues(screen, { kcal: '539', protein: '6.3', carbs: '57.5', fat: '30.9' });
      await fireEvent.press(screen.getByTestId('custom-submit'));

      const [created] = harness.repositories.food.listCustom();
      expect(routerMock.replace).toHaveBeenCalledWith({
        pathname: '/food/add',
        params: { foodItemId: created?.id, mealType: 'breakfast' },
      });
    });
  });

  it('fonctionne hors ligne : c’est tout son intérêt', async () => {
    harness.foodSource.goOffline();

    const screen = await harness.renderScreen(<CustomFoodScreen />);
    await fireEvent.changeText(screen.getByTestId('custom-name'), 'Sans réseau');
    await fillValues(screen, { kcal: '100', protein: '5', carbs: '15', fat: '2' });
    await fireEvent.press(screen.getByTestId('custom-submit'));

    expect(harness.repositories.food.listCustom()).toHaveLength(1);
    expect(harness.foodSource.calls.search + harness.foodSource.calls.lookup).toBe(0);
  });
});
