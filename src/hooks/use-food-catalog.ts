import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { BarcodeLookup, FoodDraft, RequiredNutrient } from '@/data/remote';
import { normalizeBarcode } from '@/domain/food/barcode';
import type { FoodItem } from '@/domain/food/types';
import { useSessionStore } from '@/stores/session';

import { useDebouncedValue } from './use-debounced-value';
import { useFoodSource } from './use-food-source';
import { useRepositories } from './use-repositories';

/**
 * Consultation du catalogue d'aliments : recherche et scan.
 *
 * Deux principes gouvernent ce fichier.
 *
 * **Le local d'abord.** Le repository est la source de vérité (PHASES_2_A_5
 * §4.5) : on regarde toujours le cache avant le réseau, et ce qu'il contient
 * s'affiche immédiatement, même hors ligne. Le distant ne fait que compléter.
 *
 * **L'écriture au passage.** Tout produit consulté est mis en cache au moment
 * où il est vu, scan comme recherche. C'est ce qui rend l'app utilisable dans
 * un magasin sans réseau la fois suivante — et c'est aussi ce qui économise le
 * quota Open Food Facts.
 */

/** Temps de calme avant qu'une frappe déclenche une recherche distante. */
export const SEARCH_DEBOUNCE_MS = 400;

/** En deçà, la recherche ramènerait tout et n'apprendrait rien. */
export const MIN_SEARCH_LENGTH = 3;

// --- Recherche --------------------------------------------------------------

export interface FoodSearchResult {
  /** Aliments déjà connus localement : disponibles hors ligne, affichés d'abord. */
  cached: FoodItem[];
  /** Aliments rapportés par la source distante, hors doublons du cache. */
  remote: FoodItem[];
  /** Vrai tant que la recherche distante est en cours. */
  isSearching: boolean;
  /** Échec de la recherche distante. Le cache local, lui, reste affiché. */
  error: unknown;
  /** Vrai quand la requête est trop courte pour être lancée. */
  isTooShort: boolean;
  /** Vrai si ni le cache ni le distant n'ont rien à proposer. */
  isEmpty: boolean;
}

export function useFoodSearch(query: string): FoodSearchResult {
  const repositories = useRepositories();
  const source = useFoodSource();
  const journalRevision = useSessionStore((state) => state.journalRevision);

  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const isTooShort = trimmed.length < MIN_SEARCH_LENGTH;

  // Lecture locale synchrone : elle n'attend rien et fonctionne hors ligne.
  // Elle suit la frappe sans debounce — c'est gratuit, autant être réactif.
  const cached = useMemo(
    () => (isTooShort ? [] : repositories.food.searchByName(trimmed)),
    // `journalRevision` fait relire le cache après qu'un produit y est entré.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repositories, trimmed, isTooShort, journalRevision],
  );

  const remoteQuery = useQuery({
    queryKey: ['food-search', debounced],
    enabled: debounced.length >= MIN_SEARCH_LENGTH,
    queryFn: async ({ signal }) => {
      const items = await source.searchByName(debounced, { signal });

      // Mise en cache au passage : les résultats d'aujourd'hui sont les
      // aliments consultables hors ligne de demain.
      for (const item of items) {
        repositories.food.upsert(item);
      }

      return items;
    },
  });

  const cachedIds = new Set(cached.map((item) => item.id));
  const remote = (remoteQuery.data ?? []).filter((item) => !cachedIds.has(item.id));

  return {
    cached,
    remote,
    isSearching: remoteQuery.isFetching,
    error: remoteQuery.error,
    isTooShort,
    isEmpty: !isTooShort && !remoteQuery.isFetching && cached.length === 0 && remote.length === 0,
  };
}

// --- Scan -------------------------------------------------------------------

export type ScanOutcome =
  /** Trouvé, localement ou à distance, et journalisable en l'état. */
  | { status: 'found'; item: FoodItem; fromCache: boolean }
  /** Connu de la source mais aux nutriments incomplets : à compléter à la main. */
  | { status: 'incomplete'; draft: FoodDraft; missing: RequiredNutrient[] }
  /** Code valide, produit inconnu partout : saisie manuelle. */
  | { status: 'unknown'; barcode: string }
  /** Code illisible ou mal formé : ce n'est pas la peine d'interroger qui que ce soit. */
  | { status: 'invalid' };

export interface BarcodeLookupResult {
  outcome: ScanOutcome | undefined;
  isLoading: boolean;
  /** Échec réseau. Distinct d'un produit inconnu : voir `FoodSourceError`. */
  error: unknown;
  refetch: () => void;
}

/**
 * Résout un code-barres, cache d'abord.
 *
 * @param barcode code lu, ou `undefined` tant qu'aucun scan n'a eu lieu
 */
export function useBarcodeLookup(barcode: string | undefined): BarcodeLookupResult {
  const repositories = useRepositories();
  const source = useFoodSource();

  const normalized = barcode === undefined ? undefined : normalizeBarcode(barcode);
  const code = normalized?.ok === true ? normalized.code : undefined;

  const query = useQuery<ScanOutcome>({
    queryKey: ['barcode', code],
    enabled: code !== undefined,
    queryFn: async ({ signal }): Promise<ScanOutcome> => {
      if (code === undefined) {
        return { status: 'invalid' };
      }

      // Le cache d'abord : un produit déjà scanné se rouvre sans réseau et
      // sans consommer de quota.
      const local = repositories.food.getByBarcode(code);

      if (local) {
        return { status: 'found', item: local, fromCache: true };
      }

      const lookup: BarcodeLookup = await source.lookupBarcode(code, { signal });

      if (lookup.status === 'found') {
        repositories.food.upsert(lookup.item);
        return { status: 'found', item: lookup.item, fromCache: false };
      }

      return lookup.status === 'incomplete'
        ? { status: 'incomplete', draft: lookup.draft, missing: lookup.missing }
        : { status: 'unknown', barcode: code };
    },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  // Un code mal formé n'est pas une requête en attente : c'est un résultat
  // immédiat, sinon l'écran resterait sur son indicateur de chargement.
  if (barcode !== undefined && code === undefined) {
    return { outcome: { status: 'invalid' }, isLoading: false, error: null, refetch };
  }

  return {
    ...(query.data === undefined ? { outcome: undefined } : { outcome: query.data }),
    isLoading: query.isFetching,
    error: query.error,
    refetch,
  };
}
