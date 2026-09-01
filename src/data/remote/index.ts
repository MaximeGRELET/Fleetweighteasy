import { appInfo } from '@/lib/app-info';
import { env } from '@/lib/env';

import { buildUserAgent, createOpenFoodFactsSource, type FoodCatalogSource } from './openfoodfacts';
import { FoodSourceError } from './types';

/**
 * Câblage de la source distante sur l'environnement de l'application.
 *
 * Seul module qui lit la configuration et l'identité de l'app : le reste de la
 * couche remote ne connaît ni `expo-constants`, ni les variables
 * d'environnement, ce qui permet aux tests de construire leurs propres sources.
 */

/**
 * Source de repli quand le contact Open Food Facts n'est pas configuré.
 *
 * Ce n'est pas une dégradation silencieuse : chaque appel échoue avec un motif
 * explicite, que l'UI traduit. Le choix est délibéré — le User-Agent complet
 * est une **exigence** d'OFF (PHASES_2_A_5 §4.2), et une app qui les
 * interrogerait sans contact valide risque le blocage. Mieux vaut donc fermer
 * proprement le réseau que l'utiliser sous une identité incomplète.
 *
 * L'app reste entièrement fonctionnelle par ailleurs : cache local, aliments
 * maison, repas prédéfinis et journal ne dépendent pas du réseau.
 */
export function createUnconfiguredFoodSource(): FoodCatalogSource {
  // Une nouvelle instance par appel : une erreur porte une pile, la partager
  // entre deux échecs rendrait la télémétrie illisible.
  const refusal = () =>
    new FoodSourceError(
      'not_configured',
      'Recherche en ligne désactivée : EXPO_PUBLIC_OFF_CONTACT n’est pas renseigné.',
    );

  // Rejet plutôt que levée synchrone : TanStack Query traite ainsi cet échec
  // exactement comme une panne réseau, sans chemin de code particulier.
  return {
    lookupBarcode: () => Promise.reject(refusal()),
    getByBarcode: () => Promise.reject(refusal()),
    searchByName: () => Promise.reject(refusal()),
  };
}

/**
 * Choisit la source selon le contact disponible.
 *
 * Séparée de `createAppFoodDataSource` pour que la règle — *pas de contact, pas
 * d'appel* — soit vérifiable sans manipuler l'environnement du processus de
 * test. C'est la seule décision de ce module ; ce qui l'entoure n'est que du
 * câblage.
 */
export function createFoodDataSourceFor(contact: string | undefined): FoodCatalogSource {
  if (contact === undefined) {
    return createUnconfiguredFoodSource();
  }

  return createOpenFoodFactsSource({
    userAgent: buildUserAgent({ appName: appInfo.name, version: appInfo.version, contact }),
  });
}

/**
 * Source utilisée par l'application.
 *
 * Construite une fois par le layout racine et diffusée par contexte, comme les
 * repositories : aucun écran ne l'instancie lui-même.
 */
export function createAppFoodDataSource(): FoodCatalogSource {
  return createFoodDataSourceFor(env.openFoodFactsContact);
}

/** Vrai si l'app peut interroger Open Food Facts dans cette configuration. */
export function isRemoteSearchConfigured(): boolean {
  return env.openFoodFactsContact !== undefined;
}

export {
  buildUserAgent,
  createOpenFoodFactsSource,
  type BarcodeLookup,
  type FoodCatalogSource,
} from './openfoodfacts';
export { isOpenFoodFactsItem, OFF_ID_PREFIX } from './licence';
export {
  FoodSourceError,
  isOfflineFailure,
  isRetryableFailure,
  type FoodDataSource,
  type FoodSourceFailure,
} from './types';
export type { FoodDraft, RequiredNutrient } from './off-mapping';
