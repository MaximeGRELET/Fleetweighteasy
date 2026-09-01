import { buildUserAgent, createOpenFoodFactsSource } from '@/data/remote/openfoodfacts';
import { createRateLimiter } from '@/data/remote/throttle';
import { FoodSourceError, type FoodSourceFailure } from '@/data/remote/types';

import { createFakeFetch, type FakeFetch } from './helpers/fake-fetch';
import {
  buildNotFoundResponse,
  buildOffProduct,
  buildProductResponse,
  buildSearchResponse,
  NUTELLA_BARCODE,
} from './helpers/off-fixtures';

const USER_AGENT = 'FleetWeightEasy/0.1.0 (contact@example.org)';
const FIXED_NOW = new Date('2026-03-15T08:00:00.000Z');

/** Limiteur large : ces tests portent sur la source, pas sur le quota. */
function permissiveLimiter() {
  return createRateLimiter({ maxCalls: 1000, windowMs: 60_000, maxWaitMs: 1000 });
}

function createSource(fake: FakeFetch) {
  return createOpenFoodFactsSource({
    userAgent: USER_AGENT,
    fetchImpl: fake.impl,
    now: () => FIXED_NOW,
    productLimiter: permissiveLimiter(),
    searchLimiter: permissiveLimiter(),
  });
}

/** Motif d'échec d'une promesse, quel que soit le chemin qui l'a produite. */
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

describe('User-Agent Open Food Facts', () => {
  it('accompagne chaque appel, scan comme recherche', async () => {
    // Contrainte non négociable (PHASES_2_A_5 §4.2) : sans cet en-tête, OFF
    // peut bloquer l'application entière.
    const fake = createFakeFetch();
    const source = createSource(fake);

    fake.queueJson(buildProductResponse());
    fake.queueJson(buildSearchResponse([buildOffProduct()]));

    await source.getByBarcode(NUTELLA_BARCODE);
    await source.searchByName('nutella');

    expect(fake.requests).toHaveLength(2);
    for (const request of fake.requests) {
      expect(request.headers['User-Agent']).toBe(USER_AGENT);
    }
  });

  it('se construit avec le nom, la version et un contact', () => {
    expect(
      buildUserAgent({ appName: 'FleetWeightEasy', version: '0.1.0', contact: 'x@example.org' }),
    ).toBe('FleetWeightEasy/0.1.0 (x@example.org)');
  });

  it('refuse de se construire sans contact plutôt que d’en fabriquer un tronqué', () => {
    // Le contact est ce par quoi Open Food Facts prévient avant de bloquer :
    // un User-Agent sans lui donnerait une fausse impression de conformité.
    expect(() =>
      buildUserAgent({ appName: 'FleetWeightEasy', version: '0.1.0', contact: '  ' }),
    ).toThrow(/contact est obligatoire/);
  });
});

describe('getByBarcode', () => {
  it('appelle l’endpoint v2 en limitant les champs demandés', async () => {
    const fake = createFakeFetch();
    fake.queueJson(buildProductResponse());

    await createSource(fake).getByBarcode(NUTELLA_BARCODE);

    const [request] = fake.requests;
    expect(request?.url).toContain(`/api/v2/product/${NUTELLA_BARCODE}.json`);
    // Limiter les champs allège une charge utile qui, complète, pèse des
    // dizaines de kilo-octets dont on n'affiche rien.
    expect(request?.url).toContain('fields=');
    expect(request?.url).toContain('nutriments');
    expect(request?.url).not.toContain('image');
  });

  it('normalise le code avant d’appeler : un UPC-A devient un EAN-13', async () => {
    const fake = createFakeFetch();
    fake.queueJson(buildProductResponse());

    await createSource(fake).getByBarcode('036000291452');

    expect(fake.requests[0]?.url).toContain('/product/0036000291452.json');
  });

  it('n’appelle pas le réseau sur un code invalide', async () => {
    // Le quota se compte en appels : un code mal lu ne doit pas en consommer un.
    const fake = createFakeFetch();

    const result = await createSource(fake).getByBarcode('3017620422004');

    expect(result).toBeNull();
    expect(fake.requests).toHaveLength(0);
  });

  it('convertit une fiche complète en FoodItem du domaine', async () => {
    const fake = createFakeFetch();
    fake.queueJson(buildProductResponse());

    const item = await createSource(fake).getByBarcode(NUTELLA_BARCODE);

    expect(item).toMatchObject({
      id: `off:${NUTELLA_BARCODE}`,
      source: 'off',
      barcode: NUTELLA_BARCODE,
      name: 'Nutella pâte à tartiner',
      brand: 'Ferrero',
      verified: false,
      cachedAt: FIXED_NOW.toISOString(),
    });
    expect(item?.nutritionPer100).toMatchObject({
      kcal: 539,
      proteinG: 6.3,
      carbsG: 57.5,
      fatG: 30.9,
      fiberG: 3.4,
      sodiumMg: 43,
    });
    expect(item?.servingSizes).toEqual([{ label: '15 g', grams: 15 }]);
  });

  it('renvoie null quand OFF répond « produit inconnu » sans code d’erreur', async () => {
    const fake = createFakeFetch();
    fake.queueJson(buildNotFoundResponse());

    expect(await createSource(fake).getByBarcode(NUTELLA_BARCODE)).toBeNull();
  });

  it('renvoie null sur un 404, qui est une réponse et non une panne', async () => {
    const fake = createFakeFetch();
    fake.queueStatus(404);

    expect(await createSource(fake).getByBarcode(NUTELLA_BARCODE)).toBeNull();
  });
});

describe('lookupBarcode — produits incomplets', () => {
  it('distingue « incomplet » d’« inconnu » et garde ce qu’il sait', async () => {
    // Confondre les deux ferait retaper à l'utilisateur un nom que la source
    // connaissait déjà.
    const fake = createFakeFetch();
    fake.queueJson(
      buildProductResponse(
        buildOffProduct({
          nutriments: { 'energy-kcal_100g': 250, proteins_100g: 8 },
        }),
      ),
    );

    const lookup = await createSource(fake).lookupBarcode(NUTELLA_BARCODE);

    expect(lookup.status).toBe('incomplete');
    if (lookup.status !== 'incomplete') {
      throw new Error('cas déjà écarté');
    }

    expect(lookup.missing).toEqual(['carbsG', 'fatG']);
    expect(lookup.draft.name).toBe('Nutella pâte à tartiner');
    expect(lookup.draft.barcode).toBe(NUTELLA_BARCODE);
    // Les valeurs connues sont conservées, les inconnues restent absentes —
    // jamais mises à zéro.
    expect(lookup.draft.nutritionPer100).toEqual({ kcal: 250, proteinG: 8 });
  });

  it('traite une fiche sans nom comme inexploitable', async () => {
    const fake = createFakeFetch();
    fake.queueJson(
      buildProductResponse(
        buildOffProduct({ product_name: undefined, product_name_fr: undefined }),
      ),
    );

    expect((await createSource(fake).lookupBarcode(NUTELLA_BARCODE)).status).toBe('unknown');
  });

  it('convertit les kilojoules quand les kilocalories manquent', async () => {
    // Beaucoup de fiches européennes anciennes n'ont que l'énergie en kJ :
    // abandonner là-dessus perdrait des produits parfaitement utilisables.
    const fake = createFakeFetch();
    fake.queueJson(
      buildProductResponse(
        buildOffProduct({
          nutriments: {
            energy_100g: 2255,
            proteins_100g: 6.3,
            carbohydrates_100g: 57.5,
            fat_100g: 30.9,
          },
        }),
      ),
    );

    const item = await createSource(fake).getByBarcode(NUTELLA_BARCODE);

    expect(item?.nutritionPer100.kcal).toBe(539);
  });

  it('encaisse un nutriment livré en chaîne de caractères', async () => {
    const fake = createFakeFetch();
    fake.queueJson(
      buildProductResponse(
        buildOffProduct({
          nutriments: {
            'energy-kcal_100g': '539',
            proteins_100g: 6.3,
            carbohydrates_100g: 57.5,
            fat_100g: 30.9,
          },
        }),
      ),
    );

    expect((await createSource(fake).getByBarcode(NUTELLA_BARCODE))?.nutritionPer100.kcal).toBe(
      539,
    );
  });

  it('ignore une valeur aberrante au lieu de rejeter toute la fiche', async () => {
    const fake = createFakeFetch();
    fake.queueJson(
      buildProductResponse(
        buildOffProduct({
          nutriments: {
            'energy-kcal_100g': 539,
            proteins_100g: 6.3,
            carbohydrates_100g: 57.5,
            fat_100g: 30.9,
            fiber_100g: 'inconnu',
          },
        }),
      ),
    );

    const item = await createSource(fake).getByBarcode(NUTELLA_BARCODE);

    expect(item?.nutritionPer100.kcal).toBe(539);
    expect(item?.nutritionPer100.fiberG).toBeUndefined();
  });

  it('n’invente pas de portion quand la fiche n’en donne pas', async () => {
    const fake = createFakeFetch();
    fake.queueJson(
      buildProductResponse(
        buildOffProduct({ serving_size: undefined, serving_quantity: undefined }),
      ),
    );

    expect((await createSource(fake).getByBarcode(NUTELLA_BARCODE))?.servingSizes).toEqual([]);
  });
});

describe('searchByName', () => {
  it('interroge Search-a-licious, pas l’API v2', async () => {
    // L'API v2 n'a pas de recherche plein texte : passer par elle ne
    // ramènerait rien (PHASES_2_A_5 §4.2).
    const fake = createFakeFetch();
    fake.queueJson(buildSearchResponse([buildOffProduct()]));

    await createSource(fake).searchByName('pâte à tartiner');

    const [request] = fake.requests;
    expect(request?.url).toContain('search.openfoodfacts.org/search');
    expect(request?.url).toContain(`q=${encodeURIComponent('pâte à tartiner')}`);
  });

  it('borne le nombre de résultats demandés', async () => {
    const fake = createFakeFetch();
    fake.queueJson(buildSearchResponse([]));

    await createSource(fake).searchByName('riz', { limit: 5 });

    expect(fake.requests[0]?.url).toContain('page_size=5');
  });

  it('n’appelle pas le réseau sur une requête vide', async () => {
    const fake = createFakeFetch();

    expect(await createSource(fake).searchByName('   ')).toEqual([]);
    expect(fake.requests).toHaveLength(0);
  });

  it('écarte des résultats les fiches qu’on ne pourrait pas journaliser', async () => {
    // Proposer dans une liste un produit sans valeurs nutritionnelles serait
    // une impasse : l'utilisateur le choisirait pour rien.
    const fake = createFakeFetch();
    fake.queueJson(
      buildSearchResponse([
        buildOffProduct(),
        buildOffProduct({ code: '96385074', nutriments: { proteins_100g: 3 } }),
      ]),
    );

    const results = await createSource(fake).searchByName('nutella');

    expect(results).toHaveLength(1);
    expect(results[0]?.barcode).toBe(NUTELLA_BARCODE);
  });

  it('renvoie une liste vide quand la recherche ne trouve rien', async () => {
    const fake = createFakeFetch();
    fake.queueJson(buildSearchResponse([]));

    expect(await createSource(fake).searchByName('zzzz')).toEqual([]);
  });
});

describe('pannes', () => {
  it('signale l’absence de réseau, distinctement d’un produit inconnu', async () => {
    const fake = createFakeFetch();
    fake.queueNetworkFailure();

    expect(await failureOf(createSource(fake).getByBarcode(NUTELLA_BARCODE))).toBe('offline');
  });

  it('abandonne au bout du délai maximal plutôt que de pendre', async () => {
    // Le Wi-Fi captif accepte la connexion et ne répond jamais : sans délai
    // maximal, l'écran resterait sur son indicateur de chargement pour toujours.
    const fake = createFakeFetch();
    fake.queueHang();

    const source = createOpenFoodFactsSource({
      userAgent: USER_AGENT,
      fetchImpl: fake.impl,
      timeoutMs: 20,
      productLimiter: permissiveLimiter(),
      searchLimiter: permissiveLimiter(),
    });

    expect(await failureOf(source.getByBarcode(NUTELLA_BARCODE))).toBe('timeout');
  });

  it('signale un quota distant dépassé', async () => {
    const fake = createFakeFetch();
    fake.queueStatus(429);

    expect(await failureOf(createSource(fake).searchByName('riz'))).toBe('rate_limited');
  });

  it('signale une panne serveur', async () => {
    const fake = createFakeFetch();
    fake.queueStatus(503);

    expect(await failureOf(createSource(fake).getByBarcode(NUTELLA_BARCODE))).toBe('unavailable');
  });

  it('signale une réponse illisible', async () => {
    const fake = createFakeFetch();
    fake.queueInvalidJson();

    expect(await failureOf(createSource(fake).getByBarcode(NUTELLA_BARCODE))).toBe('malformed');
  });

  it('refuse de partir quand le quota local est saturé', async () => {
    // Le limiteur préserve l'app d'un blocage par OFF : il vaut mieux échouer
    // chez nous, avec un message clair, que se faire bannir.
    const fake = createFakeFetch();
    const saturated = createRateLimiter({ maxCalls: 0, windowMs: 60_000, maxWaitMs: 0 });
    const source = createOpenFoodFactsSource({
      userAgent: USER_AGENT,
      fetchImpl: fake.impl,
      productLimiter: saturated,
      searchLimiter: saturated,
    });

    expect(await failureOf(source.searchByName('riz'))).toBe('rate_limited');
    expect(fake.requests).toHaveLength(0);
  });
});
