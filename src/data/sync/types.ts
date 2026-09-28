import type { SyncEntityType } from '@/data/db/schema';

/**
 * Contrat entre le moteur de synchronisation et le serveur.
 *
 * Le moteur ne connaît que cette interface : Supabase (ticket #19) n'en sera
 * qu'une implémentation, et les tests en fournissent une en mémoire. C'est le
 * même principe que `FoodDataSource` pour Open Food Facts.
 */

/**
 * Une version d'entité, dans un sens ou dans l'autre.
 *
 * `row` porte l'état **complet** de la ligne, tel que Drizzle le lit en local :
 * pas de diff, pour qu'une version se suffise à elle-même et qu'en appliquer
 * deux fois la même ne change rien.
 */
export interface EntityChange {
  entityType: SyncEntityType;
  entityId: string;
  /**
   * Horodatage d'origine de la version (ISO 8601 UTC). C'est lui qui départage
   * deux versions concurrentes : la plus récente gagne.
   */
  updatedAt: string;
  /** Présent : la version est une suppression, et `row` est absent. */
  deletedAt?: string;
  row?: Record<string, unknown>;
}

export interface PullPage {
  changes: EntityChange[];
  /** Position à redonner au prochain appel. Opaque : seul le serveur l'interprète. */
  cursor: string;
  hasMore: boolean;
}

export interface SyncRemote {
  /**
   * Envoie des versions locales. Le serveur applique la même règle que le
   * moteur : il ne remplace une version que par une **strictement** plus
   * récente. Une promesse résolue vaut accusé de réception du lot entier.
   */
  push(changes: EntityChange[]): Promise<void>;
  /** Versions enregistrées après `cursor`, dans l'ordre où le serveur les a reçues. */
  pull(cursor: string | undefined): Promise<PullPage>;
}

export interface SyncReport {
  /** Versions locales envoyées et acceptées. */
  pushed: number;
  /** Versions reçues du serveur. */
  pulled: number;
  /** Versions reçues qui ont effectivement modifié la base locale. */
  applied: number;
}
