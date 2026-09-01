import { fireEvent, waitFor } from '@testing-library/react-native';

import FoodScanScreen from '@/app/food/scan';
import { buildFoodItem } from '../integration/helpers/fixtures';
import { setCameraPermission, setNextScannedCode } from '../support/camera-mock';
import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock, setLocalSearchParams } from '../support/router-mock';
import { useFoodDraftStore } from '@/stores/food-draft';

const NUTELLA = '3017620422003';

/**
 * Scan de code-barres.
 *
 * La caméra est simulée (voir `tests/support/camera-mock`) : ce qui est éprouvé
 * ici, c'est **tout ce qui suit la lecture** — normalisation, cache, résolution
 * distante, et les quatre issues possibles. Aucune ne doit laisser l'écran
 * muet ou tournant (PHASES_2_A_5 §4.7).
 */
describe('scan de code-barres', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  /** Déclenche une lecture du code donné. */
  async function scan(screen: Awaited<ReturnType<AppHarness['renderScreen']>>, code: string) {
    setNextScannedCode(code);
    await fireEvent.press(screen.getByTestId('camera-view'));
  }

  describe('autorisation caméra', () => {
    it('attend la réponse du système sans rien affirmer', async () => {
      setCameraPermission(null);

      const screen = await harness.renderScreen(<FoodScanScreen />);

      expect(screen.queryByTestId('camera-view')).toBeNull();
      expect(screen.queryByTestId('scan-request-permission')).toBeNull();
    });

    it('propose d’autoriser, et garde une issue si on refuse', async () => {
      setCameraPermission({ granted: false, canAskAgain: true });

      const screen = await harness.renderScreen(<FoodScanScreen />);

      expect(screen.getByTestId('scan-request-permission')).toBeTruthy();
      // Refuser la caméra ne doit pas fermer la porte : la saisie manuelle reste.
      expect(screen.getByTestId('scan-manual-entry')).toBeTruthy();
    });

    it('renvoie vers les réglages quand le refus est définitif', async () => {
      setCameraPermission({ granted: false, canAskAgain: false });

      const screen = await harness.renderScreen(<FoodScanScreen />);

      expect(screen.queryByTestId('scan-request-permission')).toBeNull();
      expect(screen.getByText(/réglages de ton téléphone/)).toBeTruthy();
      expect(screen.getByTestId('scan-manual-entry')).toBeTruthy();
    });
  });

  it('n’écoute que les formats de codes-barres alimentaires', async () => {
    // Un QR code de ticket de caisse n'a aucune chance de désigner un produit.
    const screen = await harness.renderScreen(<FoodScanScreen />);

    const formats = screen.getByTestId('camera-view').props.accessibilityLabel;

    expect(formats).toContain('ean13');
    expect(formats).toContain('ean8');
    expect(formats).not.toContain('qr');
  });

  describe('produit trouvé', () => {
    it('enchaîne sur l’ajout au journal', async () => {
      harness.foodSource.setProduct(NUTELLA, {
        status: 'found',
        item: buildFoodItem({ id: `off:${NUTELLA}`, barcode: NUTELLA, source: 'off' }),
      });

      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, NUTELLA);

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith({
          pathname: '/food/add',
          params: { foodItemId: `off:${NUTELLA}` },
        });
      });
    });

    it('met le produit en cache au passage', async () => {
      harness.foodSource.setProduct(NUTELLA, {
        status: 'found',
        item: buildFoodItem({ id: `off:${NUTELLA}`, barcode: NUTELLA, source: 'off' }),
      });

      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, NUTELLA);

      await waitFor(() => {
        expect(harness.repositories.food.getByBarcode(NUTELLA)).toBeDefined();
      });
    });

    it('sert le cache sans rappeler le réseau, donc sans quota', async () => {
      // Rescanner un produit connu doit marcher en avion.
      harness.repositories.food.upsert(
        buildFoodItem({ id: `off:${NUTELLA}`, barcode: NUTELLA, source: 'off' }),
      );
      harness.foodSource.goOffline();

      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, NUTELLA);

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalled();
      });
      expect(harness.foodSource.calls.lookup).toBe(0);
    });

    it('conserve le repas visé jusqu’à l’écran d’ajout', async () => {
      setLocalSearchParams({ mealType: 'breakfast' });
      harness.foodSource.setProduct(NUTELLA, {
        status: 'found',
        item: buildFoodItem({ id: `off:${NUTELLA}`, barcode: NUTELLA, source: 'off' }),
      });

      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, NUTELLA);

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith({
          pathname: '/food/add',
          params: { foodItemId: `off:${NUTELLA}`, mealType: 'breakfast' },
        });
      });
    });
  });

  describe('fiche incomplète', () => {
    it('nomme ce qui manque plutôt que de dire « introuvable »', async () => {
      harness.foodSource.setProduct(NUTELLA, {
        status: 'incomplete',
        missing: ['carbsG', 'fatG'],
        draft: {
          barcode: NUTELLA,
          name: 'Pâte à tartiner',
          brand: 'Ferrero',
          nutritionPer100: { kcal: 539, proteinG: 6.3 },
          servingSizes: [],
        },
      });

      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, NUTELLA);

      await waitFor(() => {
        expect(screen.getByTestId('scan-incomplete')).toHaveTextContent(
          /les glucides et les lipides/,
        );
      });
    });

    it('pré-remplit la saisie manuelle avec ce qu’on savait déjà', async () => {
      // Faire retaper un nom que la source connaissait serait une punition
      // pour une lacune dont l'utilisateur n'est pas responsable.
      harness.foodSource.setProduct(NUTELLA, {
        status: 'incomplete',
        missing: ['fatG'],
        draft: {
          barcode: NUTELLA,
          name: 'Pâte à tartiner',
          brand: 'Ferrero',
          nutritionPer100: { kcal: 539, proteinG: 6.3, carbsG: 57.5 },
          servingSizes: [],
        },
      });

      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, NUTELLA);
      await waitFor(() => screen.getByTestId('scan-incomplete'));
      await fireEvent.press(screen.getByTestId('source-manual-entry'));

      expect(useFoodDraftStore.getState().draft).toMatchObject({
        name: 'Pâte à tartiner',
        brand: 'Ferrero',
        barcode: NUTELLA,
        nutritionPer100: { kcal: 539, proteinG: 6.3, carbsG: 57.5 },
      });
      expect(routerMock.replace).toHaveBeenCalledWith('/food/custom');
    });
  });

  describe('produit inconnu', () => {
    it('le dit et propose la saisie, en gardant le code-barres', async () => {
      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, NUTELLA);

      await waitFor(() => {
        expect(screen.getByTestId('scan-unknown')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('source-manual-entry'));

      // Le code est conservé : l'aliment maison sera retrouvé au prochain scan.
      expect(useFoodDraftStore.getState().draft?.barcode).toBe(NUTELLA);
    });
  });

  describe('code illisible', () => {
    it('n’interroge pas le réseau et explique le problème', async () => {
      // Clé de contrôle fausse : le code ne désigne aucun produit, l'appel
      // aurait consommé du quota pour rien.
      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, '3017620422004');

      expect(screen.getByTestId('scan-invalid')).toHaveTextContent(/incohérent/);
      expect(harness.foodSource.calls.lookup).toBe(0);
      expect(screen.queryByTestId('scan-loading')).toBeNull();
    });

    it('permet de relancer la lecture', async () => {
      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, '12345');

      await fireEvent.press(screen.getByTestId('source-retry'));

      expect(screen.getByTestId('scan-viewfinder')).toBeTruthy();
      expect(screen.queryByTestId('scan-invalid')).toBeNull();
    });
  });

  describe('hors ligne', () => {
    it('explique la panne et propose les deux issues', async () => {
      harness.foodSource.goOffline();

      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, NUTELLA);

      await waitFor(() => {
        expect(screen.getByTestId('scan-error')).toHaveTextContent(/Pas de connexion/);
      });

      expect(screen.getByTestId('source-retry')).toBeTruthy();
      expect(screen.getByTestId('source-manual-entry')).toBeTruthy();
      expect(screen.queryByTestId('scan-loading')).toBeNull();
    });

    it('laisse repartir sur un autre produit', async () => {
      harness.foodSource.goOffline();

      const screen = await harness.renderScreen(<FoodScanScreen />);
      await scan(screen, NUTELLA);
      await waitFor(() => screen.getByTestId('scan-error'));

      expect(screen.getByTestId('scan-again')).toBeTruthy();
    });
  });
});
