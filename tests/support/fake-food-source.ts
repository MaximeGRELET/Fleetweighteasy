import type { BarcodeLookup, FoodCatalogSource } from '@/data/remote';
import { FoodSourceError, type FoodSourceFailure } from '@/data/remote/types';
import type { FoodItem } from '@/domain/food/types';

/**
 * Source alimentaire de test.
 *
 * Aucun test n'atteint le réseau (PHASES_2_A_5 §4.8). Cette doublure permet en
 * plus de mettre en scène ce qui compte vraiment dans cette phase : le produit
 * inconnu, la fiche incomplète, et surtout **l'absence de réseau** — trois
 * situations qu'un vrai serveur ne produirait pas sur commande.
 */

export interface FakeFoodSource extends FoodCatalogSource {
  /** Produit renvoyé au scan d'un code donné. */
  setProduct: (barcode: string, lookup: BarcodeLookup) => void;
  /** Résultats renvoyés par la recherche, quelle que soit la requête. */
  setSearchResults: (items: FoodItem[]) => void;
  /** Fait échouer tous les appels suivants — l'app est « hors ligne ». */
  goOffline: (reason?: FoodSourceFailure) => void;
  /** Rétablit la source. */
  goOnline: () => void;
  /** Empêche toute résolution : la requête reste en vol (réseau qui pend). */
  hang: () => void;
  /** Nombre d'appels réellement passés, par type. */
  calls: { search: number; lookup: number };
}

export function createFakeFoodSource(): FakeFoodSource {
  const products = new Map<string, BarcodeLookup>();
  let searchResults: FoodItem[] = [];
  let failure: FoodSourceFailure | undefined;
  let hanging = false;
  const calls = { search: 0, lookup: 0 };

  function guard<T>(value: T): Promise<T> {
    if (hanging) {
      // Ne se résout jamais : c'est ainsi qu'on éprouve qu'un écran reste
      // utilisable pendant que le réseau traîne.
      return new Promise<T>(() => {});
    }

    return failure === undefined
      ? Promise.resolve(value)
      : Promise.reject(new FoodSourceError(failure, `Source de test indisponible (${failure}).`));
  }

  return {
    calls,

    setProduct: (barcode, lookup) => products.set(barcode, lookup),
    setSearchResults: (items) => {
      searchResults = items;
    },
    goOffline: (reason = 'offline') => {
      failure = reason;
    },
    goOnline: () => {
      failure = undefined;
      hanging = false;
    },
    hang: () => {
      hanging = true;
    },

    lookupBarcode: (barcode) => {
      calls.lookup += 1;
      return guard(products.get(barcode) ?? ({ status: 'unknown' } as BarcodeLookup));
    },

    getByBarcode: async (barcode) => {
      calls.lookup += 1;
      const lookup = await guard(products.get(barcode) ?? ({ status: 'unknown' } as BarcodeLookup));
      return lookup.status === 'found' ? lookup.item : null;
    },

    searchByName: (query) => {
      calls.search += 1;
      return guard(query.trim() === '' ? [] : searchResults);
    },
  };
}
