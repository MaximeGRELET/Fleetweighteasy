import { z } from 'zod';

import { normalizeBarcode } from '@/domain/food/barcode';
import type { FoodItem } from '@/domain/food/types';

import { createHttpClient, HttpNotFoundError, type HttpClient } from './http';
import {
  OFF_PRODUCT_FIELDS,
  parseOffProduct,
  type FoodDraft,
  type ProductMapping,
  type RequiredNutrient,
} from './off-mapping';
import { createRateLimiter, RateLimitExceededError, type RateLimiter } from './throttle';
import {
  FoodSourceError,
  type FoodDataSource,
  type FoodDataSourceOptions,
  type FoodSearchOptions,
} from './types';

/**
 * Source Open Food Facts.
 *
 * Seul module de l'app qui connaît les URL, les noms de champs et les quotas
 * d'OFF. Il implémente `FoodDataSource` : changer de fournisseur revient à
 * écrire un fichier voisin, sans toucher aux hooks ni aux écrans.
 *
 * Deux endpoints, deux services distincts, pour la raison donnée en
 * PHASES_2_A_5 §4.2 : **l'API v2 n'offre pas de recherche plein texte**. Le
 * scan interroge `/api/v2/product/{code}.json`, la recherche textuelle passe
 * par Search-a-licious. Les deux ont leurs propres quotas, donc leur propre
 * limiteur.
 */

export const OFF_PRODUCT_BASE_URL = 'https://world.openfoodfacts.org';
export const OFF_SEARCH_BASE_URL = 'https://search.openfoodfacts.org';

/**
 * Quotas locaux, tenus **en deçà** de ce qu'annonce Open Food Facts.
 *
 * OFF documente 100 lectures produit et 10 recherches par minute. On se garde
 * une marge : le compteur du serveur et le nôtre ne démarrent pas au même
 * instant, et se faire bloquer coûte bien plus cher qu'attendre une seconde.
 */
export const PRODUCT_RATE_LIMIT = { maxCalls: 80, windowMs: 60_000, maxWaitMs: 5_000 };
export const SEARCH_RATE_LIMIT = { maxCalls: 8, windowMs: 60_000, maxWaitMs: 5_000 };

/** Au-delà, la liste n'est plus lisible et l'appel s'alourdit pour rien. */
export const DEFAULT_SEARCH_LIMIT = 20;

export interface OpenFoodFactsOptions {
  /** User-Agent complet. Obligatoire : voir `buildUserAgent`. */
  userAgent: string;
  /** Horloge injectée, pour dater la mise en cache sans dépendre du temps réel. */
  now?: () => Date;
  /** `fetch` injecté : aucun test ne touche le réseau. */
  fetchImpl?: typeof fetch;
  productBaseUrl?: string;
  searchBaseUrl?: string;
  /** Limiteurs injectables, pour que les tests n'attendent pas une minute. */
  productLimiter?: RateLimiter;
  searchLimiter?: RateLimiter;
  timeoutMs?: number;
}

/**
 * Résultat détaillé d'un scan.
 *
 * `FoodDataSource.getByBarcode` réduit ce résultat à `FoodItem | null`, ce qui
 * suffit à la plupart des appelants. L'écran de scan, lui, a besoin de la
 * nuance : un produit connu mais aux nutriments incomplets doit pré-remplir le
 * formulaire de saisie manuelle plutôt que d'être annoncé comme introuvable
 * (PHASES_2_A_5 §4.3).
 */
export type BarcodeLookup =
  | { status: 'found'; item: FoodItem }
  | { status: 'incomplete'; draft: FoodDraft; missing: RequiredNutrient[] }
  | { status: 'unknown' };

/**
 * Source alimentaire enrichie.
 *
 * Écart assumé par rapport à l'interface à deux méthodes de PHASES_2_A_5 §4.5 :
 * `lookupBarcode` est ajoutée pour que l'UI puisse traiter le cas « trouvé mais
 * incomplet » sans rien savoir d'Open Food Facts. Sans elle, ce cas obligerait
 * soit à perdre le nom du produit, soit à faire remonter des champs OFF
 * jusqu'aux écrans — exactement ce que la couche d'abstraction évite.
 */
export interface FoodCatalogSource extends FoodDataSource {
  lookupBarcode(barcode: string, options?: FoodDataSourceOptions): Promise<BarcodeLookup>;
}

/**
 * Construit le User-Agent exigé par Open Food Facts.
 *
 * Sans lui, l'app risque un blocage (PHASES_2_A_5 §4.2). Le contact est une
 * exigence de la politique OFF : c'est par là qu'ils préviennent avant de
 * bloquer. Il n'est donc pas facultatif — la fonction refuse de fabriquer un
 * en-tête incomplet plutôt que d'en produire un qui ferait illusion.
 */
export function buildUserAgent(input: {
  appName: string;
  version: string;
  contact: string;
}): string {
  const contact = input.contact.trim();

  if (contact === '') {
    throw new Error(
      'User-Agent Open Food Facts incomplet : un contact est obligatoire. ' +
        'Renseigne EXPO_PUBLIC_OFF_CONTACT (voir .env.example).',
    );
  }

  return `${input.appName}/${input.version} (${contact})`;
}

// --- Contrats de réponse ----------------------------------------------------

/**
 * Enveloppe de `/api/v2/product/{code}.json`.
 *
 * `status` vaut 0 quand le produit est inconnu — et l'API ne renvoie pas
 * toujours un 404 dans ce cas, d'où la double vérification.
 */
const productResponseSchema = z.looseObject({
  status: z.union([z.number(), z.string()]).optional().catch(undefined),
  product: z.unknown().optional(),
});

/** Enveloppe Search-a-licious : les produits sont dans `hits`. */
const searchResponseSchema = z.looseObject({
  hits: z.array(z.unknown()).optional().catch(undefined),
});

// --- Implémentation ---------------------------------------------------------

export function createOpenFoodFactsSource(options: OpenFoodFactsOptions): FoodCatalogSource {
  const now = options.now ?? (() => new Date());
  const productBaseUrl = options.productBaseUrl ?? OFF_PRODUCT_BASE_URL;
  const searchBaseUrl = options.searchBaseUrl ?? OFF_SEARCH_BASE_URL;

  const http: HttpClient = createHttpClient({
    userAgent: options.userAgent,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
  });

  const productLimiter = options.productLimiter ?? createRateLimiter(PRODUCT_RATE_LIMIT);
  const searchLimiter = options.searchLimiter ?? createRateLimiter(SEARCH_RATE_LIMIT);

  /** Traduit un dépassement de quota local dans le vocabulaire de la source. */
  async function reserve(limiter: RateLimiter): Promise<void> {
    try {
      await limiter.acquire();
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        throw new FoodSourceError('rate_limited', error.message);
      }

      throw error;
    }
  }

  async function lookupBarcode(
    barcode: string,
    callOptions: FoodDataSourceOptions = {},
  ): Promise<BarcodeLookup> {
    const normalized = normalizeBarcode(barcode);

    // Un code mal lu ne part pas sur le réseau : il n'aurait rien ramené, et
    // chaque appel se prend sur le quota.
    if (!normalized.ok) {
      return { status: 'unknown' };
    }

    await reserve(productLimiter);

    const url =
      `${productBaseUrl}/api/v2/product/${normalized.code}.json` +
      `?fields=${OFF_PRODUCT_FIELDS.join(',')}`;

    let payload: unknown;

    try {
      payload = await http.getJson<unknown>(url, callOptions);
    } catch (error) {
      // Un 404 est une réponse, pas une panne : le produit n'existe pas chez OFF.
      if (error instanceof HttpNotFoundError) {
        return { status: 'unknown' };
      }

      throw error;
    }

    const envelope = productResponseSchema.safeParse(payload);

    if (!envelope.success) {
      throw new FoodSourceError('malformed', `Enveloppe produit inattendue sur ${url}.`);
    }

    // `status: 0` = produit inconnu, sans code HTTP d'erreur.
    if (envelope.data.status !== undefined && Number(envelope.data.status) === 0) {
      return { status: 'unknown' };
    }

    if (envelope.data.product === undefined) {
      return { status: 'unknown' };
    }

    return toLookup(parseOffProduct(envelope.data.product, now().toISOString()));
  }

  async function searchByName(
    query: string,
    callOptions: FoodSearchOptions = {},
  ): Promise<FoodItem[]> {
    const trimmed = query.trim();

    if (trimmed.length === 0) {
      return [];
    }

    await reserve(searchLimiter);

    const limit = callOptions.limit ?? DEFAULT_SEARCH_LIMIT;
    const url =
      `${searchBaseUrl}/search?q=${encodeURIComponent(trimmed)}` +
      `&page_size=${limit}&fields=${OFF_PRODUCT_FIELDS.join(',')}`;

    const payload = await http.getJson<unknown>(url, callOptions);
    const envelope = searchResponseSchema.safeParse(payload);

    if (!envelope.success) {
      throw new FoodSourceError('malformed', `Enveloppe de recherche inattendue sur ${url}.`);
    }

    const cachedAt = now().toISOString();

    // Les fiches incomplètes sont écartées des résultats : proposer dans une
    // liste un produit qu'on ne pourra pas journaliser serait une impasse. Le
    // scan, lui, les récupère — parce que là, l'utilisateur a le produit en main.
    return (envelope.data.hits ?? [])
      .map((hit) => parseOffProduct(hit, cachedAt))
      .flatMap((mapping) => (mapping.status === 'found' ? [mapping.item] : []));
  }

  return {
    lookupBarcode,
    searchByName,

    async getByBarcode(barcode, callOptions) {
      const lookup = await lookupBarcode(barcode, callOptions);
      return lookup.status === 'found' ? lookup.item : null;
    },
  };
}

function toLookup(mapping: ProductMapping): BarcodeLookup {
  switch (mapping.status) {
    case 'found':
      return { status: 'found', item: mapping.item };
    case 'incomplete':
      return { status: 'incomplete', draft: mapping.draft, missing: mapping.missing };
    default:
      return { status: 'unknown' };
  }
}
