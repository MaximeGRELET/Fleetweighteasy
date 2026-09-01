import { FoodSourceError } from '@/data/remote/types';
import type { FoodSourceFailure } from '@/data/remote/types';
import { REQUIRED_NUTRIENTS } from '@/data/remote/off-mapping';
import type { BarcodeRejection } from '@/domain/food/barcode';
import {
  explainBarcodeRejection,
  explainIncompleteProduct,
  explainSourceError,
  UNKNOWN_PRODUCT_MESSAGE,
} from '@/lib/messages/food-source';

/**
 * Même exigence que pour les garde-fous de santé : **aucun échec silencieux**.
 * Un motif d'échec sans message serait un écran vide ou un indicateur de
 * chargement éternel — ce que la phase interdit explicitement (§4.7).
 */
const ALL_FAILURES: FoodSourceFailure[] = [
  'offline',
  'timeout',
  'rate_limited',
  'unavailable',
  'malformed',
  'not_configured',
];

const ALL_REJECTIONS: BarcodeRejection[] = [
  'empty',
  'not_numeric',
  'unsupported_length',
  'bad_check_digit',
];

describe('explainSourceError', () => {
  it.each(ALL_FAILURES)('traduit le motif « %s » sans jamais rester muet', (reason) => {
    const message = explainSourceError(new FoodSourceError(reason, 'test'));

    expect(message.title.length).toBeGreaterThan(0);
    expect(message.body.length).toBeGreaterThan(0);
  });

  it.each(ALL_FAILURES)('laisse toujours une issue sur « %s »', (reason) => {
    // Un message sans action ne vaut guère mieux qu'un écran vide : chaque
    // échec doit proposer au moins de réessayer ou de saisir à la main.
    const message = explainSourceError(new FoodSourceError(reason, 'test'));

    expect(message.offersManualEntry || message.offersRetry).toBe(true);
  });

  it('ne propose pas de réessayer ce qui ne peut pas réussir', () => {
    // Réessayer une recherche non configurée échouerait à l'identique :
    // proposer le bouton serait mentir sur ce qui va se passer.
    expect(explainSourceError(new FoodSourceError('not_configured', 'x')).offersRetry).toBe(false);
    expect(explainSourceError(new FoodSourceError('malformed', 'x')).offersRetry).toBe(false);
  });

  it('dit que le local reste disponible quand le réseau manque', () => {
    // C'est l'information la plus utile hors ligne : l'app n'est pas cassée.
    expect(explainSourceError(new FoodSourceError('offline', 'x')).body).toMatch(
      /déjà consultés|enregistrés|disponibles/,
    );
  });

  it('reste explicite face à une erreur qu’on n’a pas prévue', () => {
    const message = explainSourceError(new Error('inattendu'));

    expect(message.title.length).toBeGreaterThan(0);
    expect(message.offersManualEntry).toBe(true);
  });
});

describe('explainBarcodeRejection', () => {
  it.each(ALL_REJECTIONS)('traduit le rejet « %s »', (reason) => {
    const message = explainBarcodeRejection(reason);

    expect(message.body.length).toBeGreaterThan(0);
    expect(message.offersRetry).toBe(true);
  });

  it('suggère quoi faire quand la lecture a échoué', () => {
    expect(explainBarcodeRejection('bad_check_digit').body).toMatch(/Réessaie/);
  });
});

describe('explainIncompleteProduct', () => {
  it.each(REQUIRED_NUTRIENTS)('nomme le nutriment manquant « %s »', (nutrient) => {
    // « Données incomplètes » n'aide personne. Nommer ce qui manque dit
    // exactement quoi lire sur l'étiquette.
    const message = explainIncompleteProduct([nutrient]);

    expect(message.body).toMatch(/manque \w/);
    expect(message.offersManualEntry).toBe(true);
  });

  it('énumère plusieurs manques en français, pas en liste à virgules', () => {
    const message = explainIncompleteProduct(['carbsG', 'fatG']);

    expect(message.body).toContain('les glucides et les lipides');
  });

  it('énumère trois manques avec la bonne conjonction', () => {
    const message = explainIncompleteProduct(['proteinG', 'carbsG', 'fatG']);

    expect(message.body).toContain('les protéines, les glucides et les lipides');
  });

  it('annonce que ce qui est connu est conservé', () => {
    expect(explainIncompleteProduct(['fatG']).body).toMatch(/on garde le reste/i);
  });

  it('reste une phrase lisible même sans manque à énumérer', () => {
    // Cas que le mapper ne produit pas — il ne signale « incomplet » qu'avec
    // une liste non vide — mais une phrase tronquée serait pire qu'un test.
    expect(explainIncompleteProduct([]).body).not.toContain('undefined');
  });
});

describe('produit inconnu', () => {
  it('se distingue d’une panne : c’est une réponse, pas un échec', () => {
    expect(UNKNOWN_PRODUCT_MESSAGE.title).toMatch(/inconnu/i);
    expect(UNKNOWN_PRODUCT_MESSAGE.offersRetry).toBe(false);
    expect(UNKNOWN_PRODUCT_MESSAGE.offersManualEntry).toBe(true);
  });

  it('explique que la saisie ne sera pas à refaire', () => {
    expect(UNKNOWN_PRODUCT_MESSAGE.body).toMatch(/une fois|ensuite disponible/);
  });
});
