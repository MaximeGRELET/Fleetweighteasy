import { createHttpClient } from '@/data/remote/http';
import {
  createAppFoodDataSource,
  createFoodDataSourceFor,
  createUnconfiguredFoodSource,
  isRemoteSearchConfigured,
} from '@/data/remote';
import { isOpenFoodFactsItem, OFF_ID_PREFIX } from '@/data/remote/licence';
import { mapOffProduct, offItemId, parseOffProduct } from '@/data/remote/off-mapping';
import { createOpenFoodFactsSource } from '@/data/remote/openfoodfacts';
import { createRateLimiter } from '@/data/remote/throttle';
import {
  FoodSourceError,
  isOfflineFailure,
  isRetryableFailure,
  type FoodSourceFailure,
} from '@/data/remote/types';

import { createFakeFetch } from './helpers/fake-fetch';
import { buildOffProduct, NUTELLA_BARCODE } from './helpers/off-fixtures';

const USER_AGENT = 'FleetWeightEasy/0.1.0 (contact@example.org)';
const CACHED_AT = '2026-03-15T08:00:00.000Z';

function permissiveLimiter() {
  return createRateLimiter({ maxCalls: 1000, windowMs: 60_000, maxWaitMs: 1000 });
}

async function failureOf(promise: Promise<unknown>): Promise<FoodSourceFailure> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof FoodSourceError) {
      return error.reason;
    }

    throw error;
  }

  throw new Error('La promesse aurait dû échouer.');
}

describe('classification des échecs', () => {
  it('ne réessaie que ce qu’une nouvelle tentative peut résoudre', () => {
    // Réessayer un quota dépassé l'aggraverait ; réessayer une panne
    // passagère est exactement ce qu'il faut faire.
    expect(isRetryableFailure(new FoodSourceError('timeout', 'x'))).toBe(true);
    expect(isRetryableFailure(new FoodSourceError('unavailable', 'x'))).toBe(true);
    expect(isRetryableFailure(new FoodSourceError('rate_limited', 'x'))).toBe(false);
    expect(isRetryableFailure(new FoodSourceError('offline', 'x'))).toBe(false);
    expect(isRetryableFailure(new FoodSourceError('not_configured', 'x'))).toBe(false);
  });

  it('ne prend pas une erreur ordinaire pour un échec de source', () => {
    expect(isRetryableFailure(new Error('autre chose'))).toBe(false);
    expect(isOfflineFailure(new Error('autre chose'))).toBe(false);
  });

  it('reconnaît les deux visages d’une absence de réseau', () => {
    // Un délai dépassé et une requête qui n'part jamais appellent le même
    // message : « on ne peut pas aller chercher la donnée maintenant ».
    expect(isOfflineFailure(new FoodSourceError('offline', 'x'))).toBe(true);
    expect(isOfflineFailure(new FoodSourceError('timeout', 'x'))).toBe(true);
    expect(isOfflineFailure(new FoodSourceError('unavailable', 'x'))).toBe(false);
  });

  it('conserve le statut HTTP quand il y en a un, sans l’inventer', () => {
    expect(new FoodSourceError('unavailable', 'x', 503).status).toBe(503);
    expect(new FoodSourceError('offline', 'x').status).toBeUndefined();
  });
});

describe('source non configurée', () => {
  it('refuse tous les appels avec un motif explicite', async () => {
    // Sans contact, le User-Agent serait incomplet : Open Food Facts exige
    // l'inverse. On ferme le réseau plutôt que d'y aller masqué.
    const source = createUnconfiguredFoodSource();

    expect(await failureOf(source.searchByName('riz'))).toBe('not_configured');
    expect(await failureOf(source.getByBarcode(NUTELLA_BARCODE))).toBe('not_configured');
    expect(await failureOf(source.lookupBarcode(NUTELLA_BARCODE))).toBe('not_configured');
  });

  it('est celle que l’app construit tant que le contact manque', async () => {
    // `EXPO_PUBLIC_OFF_CONTACT` n'est pas renseigné en test : c'est exactement
    // la situation d'une installation non configurée.
    expect(isRemoteSearchConfigured()).toBe(false);
    expect(await failureOf(createAppFoodDataSource().searchByName('riz'))).toBe('not_configured');
  });

  it('cède la place à la vraie source dès qu’un contact est fourni', async () => {
    const configured = createFoodDataSourceFor('contact@example.org');

    // Une requête vide est court-circuitée avant tout appel réseau : elle
    // distingue donc les deux sources sans qu'aucune ne sorte de la machine.
    // La source configurée répond ; la non configurée refuse.
    await expect(configured.searchByName('  ')).resolves.toEqual([]);
    expect(await failureOf(createUnconfiguredFoodSource().searchByName('  '))).toBe(
      'not_configured',
    );
  });
});

describe('frontière ODbL', () => {
  it('reconnaît une donnée Open Food Facts à sa colonne source', () => {
    expect(isOpenFoodFactsItem({ source: 'off' })).toBe(true);
    expect(isOpenFoodFactsItem({ source: 'custom' })).toBe(false);
  });

  it('préfixe les identifiants pour que l’origine se lise sans jointure', () => {
    expect(offItemId(NUTELLA_BARCODE)).toBe(`${OFF_ID_PREFIX}${NUTELLA_BARCODE}`);
  });
});

describe('conversion défensive des fiches', () => {
  it('traite une charge utile illisible comme inexploitable', () => {
    expect(parseOffProduct('pas un objet', CACHED_AT).status).toBe('unusable');
    expect(parseOffProduct(null, CACHED_AT).status).toBe('unusable');
  });

  it('se rabat sur le nom générique quand les autres manquent', () => {
    const mapping = mapOffProduct(
      buildOffProduct({
        product_name: undefined,
        product_name_fr: '   ',
        generic_name: 'Pâte à tartiner',
      }),
      CACHED_AT,
    );

    expect(mapping.status).toBe('found');
    expect(mapping.status === 'found' ? mapping.item.name : undefined).toBe('Pâte à tartiner');
  });

  it('ignore une marque vide plutôt que d’afficher une parenthèse creuse', () => {
    const mapping = mapOffProduct(buildOffProduct({ brands: '  ,  ' }), CACHED_AT);

    expect(mapping.status === 'found' ? mapping.item.brand : 'présent').toBeUndefined();
  });

  it('nomme une portion sans libellé plutôt que de la laisser vide', () => {
    const mapping = mapOffProduct(
      buildOffProduct({ serving_size: '   ', serving_quantity: 30 }),
      CACHED_AT,
    );

    expect(mapping.status === 'found' ? mapping.item.servingSizes : []).toEqual([
      { label: 'Portion', grams: 30 },
    ]);
  });

  it('écarte une portion de poids nul, qui ne veut rien dire', () => {
    const mapping = mapOffProduct(buildOffProduct({ serving_quantity: 0 }), CACHED_AT);

    expect(mapping.status === 'found' ? mapping.item.servingSizes : ['non vide']).toEqual([]);
  });

  it('traite une fiche sans bloc nutriments comme incomplète, pas comme nulle', () => {
    // Absence de données n'est pas donnée nulle : un produit dont on ignore
    // tout n'est pas un produit à zéro calorie.
    const mapping = mapOffProduct(buildOffProduct({ nutriments: undefined }), CACHED_AT);

    expect(mapping.status).toBe('incomplete');
    expect(mapping.status === 'incomplete' ? mapping.missing : []).toEqual([
      'kcal',
      'proteinG',
      'carbsG',
      'fatG',
    ]);
  });

  it('refuse une fiche sans code-barres : rien à mettre en cache', () => {
    expect(mapOffProduct(buildOffProduct({ code: '  ' }), CACHED_AT).status).toBe('unusable');
  });
});

describe('enveloppes inattendues', () => {
  it('signale une enveloppe produit hors contrat', async () => {
    const fake = createFakeFetch();
    fake.queueJson('une chaîne au lieu d’un objet');

    const source = createOpenFoodFactsSource({
      userAgent: USER_AGENT,
      fetchImpl: fake.impl,
      productLimiter: permissiveLimiter(),
      searchLimiter: permissiveLimiter(),
    });

    expect(await failureOf(source.getByBarcode(NUTELLA_BARCODE))).toBe('malformed');
  });

  it('signale une enveloppe de recherche hors contrat', async () => {
    const fake = createFakeFetch();
    fake.queueJson(42);

    const source = createOpenFoodFactsSource({
      userAgent: USER_AGENT,
      fetchImpl: fake.impl,
      productLimiter: permissiveLimiter(),
      searchLimiter: permissiveLimiter(),
    });

    expect(await failureOf(source.searchByName('riz'))).toBe('malformed');
  });

  it('traite une réponse sans produit comme un produit inconnu', async () => {
    const fake = createFakeFetch();
    fake.queueJson({ status: 1, code: NUTELLA_BARCODE });

    const source = createOpenFoodFactsSource({
      userAgent: USER_AGENT,
      fetchImpl: fake.impl,
      productLimiter: permissiveLimiter(),
      searchLimiter: permissiveLimiter(),
    });

    expect(await source.getByBarcode(NUTELLA_BARCODE)).toBeNull();
  });

  it('accepte une réponse sans champ `hits`', async () => {
    const fake = createFakeFetch();
    fake.queueJson({ count: 0 });

    const source = createOpenFoodFactsSource({
      userAgent: USER_AGENT,
      fetchImpl: fake.impl,
      productLimiter: permissiveLimiter(),
      searchLimiter: permissiveLimiter(),
    });

    expect(await source.searchByName('riz')).toEqual([]);
  });
});

describe('client HTTP', () => {
  it('se construit avec ses valeurs par défaut, sans rien exiger', () => {
    // `fetch` et le délai maximal de l'app : les tests injectent toujours les
    // leurs, ce cas vérifie que le chemin réel tient debout.
    expect(() => createHttpClient({ userAgent: USER_AGENT })).not.toThrow();
  });

  it('laisse remonter une annulation demandée par l’appelant', async () => {
    // Une recherche abandonnée parce que l'utilisateur a continué à taper n'est
    // pas une panne : la confondre afficherait un message d'erreur pour rien.
    const fake = createFakeFetch();
    fake.queueHang();

    const controller = new AbortController();
    const client = createHttpClient({ userAgent: USER_AGENT, fetchImpl: fake.impl });
    const promise = client.getJson('https://example.org/x', { signal: controller.signal });

    controller.abort();

    await expect(promise).rejects.not.toBeInstanceOf(FoodSourceError);
  });
});

describe('limiteur de débit — horloge réelle', () => {
  it('attend vraiment quand aucun créneau n’est libre', async () => {
    // Les autres tests injectent une horloge ; celui-ci éprouve l'attente par
    // défaut, celle qui tournera dans l'app.
    const limiter = createRateLimiter({ maxCalls: 1, windowMs: 20, maxWaitMs: 500 });

    const startedAt = Date.now();
    await limiter.acquire();
    await limiter.acquire();

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(20);
  });
});
