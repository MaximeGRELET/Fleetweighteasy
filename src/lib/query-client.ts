import { QueryClient } from '@tanstack/react-query';

import { isRetryableFailure } from '@/data/remote';

/**
 * Configuration de TanStack Query.
 *
 * Périmètre volontairement **restreint au distant**. Les lectures locales
 * (journal, poids, aliments en cache) passent par les repositories SQLite, qui
 * sont synchrones : les faire transiter par une couche asynchrone ajouterait un
 * état de chargement là où il n'y en a pas, donc un scintillement à chaque
 * rendu, sans rien apporter. TanStack Query sert ici ce qu'il fait le mieux —
 * déduplication, annulation, réessais, cache mémoire des appels réseau.
 *
 * La persistance hors-ligne, elle, est déjà assurée : tout produit consulté est
 * écrit dans `food.repo` au moment où il est vu (voir `use-food-catalog`). La
 * base locale **est** le cache persistant ; en dupliquer un second, sérialisé
 * depuis le cache mémoire, créerait deux vérités à réconcilier.
 */

/** Deux tentatives supplémentaires au plus : au-delà, l'utilisateur a abandonné. */
const MAX_RETRIES = 2;

/**
 * Une fiche produit ne change pas d'une minute à l'autre.
 *
 * Cette fraîcheur généreuse est aussi une mesure de quota : Open Food Facts
 * limite les appels par endpoint, et refaire la même requête en revenant sur un
 * écran serait le meilleur moyen de s'en approcher pour rien.
 */
const STALE_TIME_MS = 10 * 60_000;

/** Durée de rétention en mémoire après la dernière utilisation. */
const GC_TIME_MS = 30 * 60_000;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,

        /**
         * `always` plutôt que le mode « online » par défaut.
         *
         * En mode par défaut, TanStack Query **met en pause** une requête quand
         * il croit l'appareil hors ligne — et sans détecteur réseau branché,
         * cette croyance n'est pas fiable. Une requête en pause laisse l'écran
         * sur un indicateur de chargement qui ne se résout jamais : exactement
         * le « spinner bloqué » que la phase interdit (PHASES_2_A_5 §4.7).
         *
         * On préfère laisser partir l'appel : notre client HTTP a un délai
         * maximal et rend un motif `offline` explicite, que l'UI sait afficher
         * avec son repli sur la saisie manuelle.
         */
        networkMode: 'always',

        // Un produit introuvable ou un quota atteint ne se résoudront pas en
        // réessayant : seules les pannes passagères méritent une relance.
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryableFailure(error),
        refetchOnWindowFocus: false,
      },
      mutations: { networkMode: 'always' },
    },
  });
}
