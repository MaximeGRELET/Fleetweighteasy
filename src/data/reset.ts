import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  consent,
  foodItem,
  foodLogEntry,
  meal,
  profile,
  syncMeta,
  weightEntry,
  workoutLogEntry,
} from './db/schema';
import type { AppDatabase } from './db/types';

/**
 * Effacement complet des données locales.
 *
 * Sert d'abord à l'outillage de développement (bouton « Réinitialiser les
 * données » du panneau de debug) : repasser l'onboarding sur un appareil sans
 * désinstaller l'app. Le jour où l'écran de réglages proposera la suppression
 * de compte (RGPD), c'est cette même fonction qui sera appelée — d'où sa place
 * ici, dans la couche data, et non dans un écran.
 *
 * Deux différences assumées avec les `clear()` / `revoke()` des repositories :
 *
 * - `sync_meta` est **vidée**, pas remplie de pierres tombales. Un `clear()`
 *   isolé doit propager la suppression au serveur (Phase 9) ; ici on simule une
 *   installation neuve, où il n'y a rien à propager parce qu'il n'y a jamais
 *   rien eu.
 * - `__drizzle_migrations` n'est **pas** touchée. L'effacer ferait rejouer les
 *   migrations au démarrage suivant, sur des tables déjà créées : l'app
 *   échouerait à s'ouvrir. Le schéma reste, seul son contenu disparaît.
 */

/**
 * Tables effacées, enfants avant parents.
 *
 * L'ordre n'est pas décoratif : `food_log_entry` référence `food_item` et
 * `meal` en `ON DELETE SET NULL`. Commencer par le journal évite de réécrire
 * des lignes juste avant de les supprimer.
 *
 * Toute table ajoutée au schéma doit être ajoutée ici — le test
 * `tests/integration/reset.test.ts` échoue si on l'oublie.
 */
const RESETTABLE_TABLES: readonly SQLiteTable[] = [
  foodLogEntry,
  workoutLogEntry,
  weightEntry,
  meal,
  foodItem,
  profile,
  consent,
  syncMeta,
];

/**
 * Vide toutes les tables applicatives, en une seule transaction.
 *
 * Tout ou rien : une réinitialisation interrompue à mi-parcours laisserait un
 * profil sans consentement, ou un journal orphelin — précisément l'état
 * incohérent qu'on cherche à faire disparaître.
 */
export function resetAllLocalData(db: AppDatabase): void {
  db.transaction((tx) => {
    for (const table of RESETTABLE_TABLES) {
      tx.delete(table).run();
    }
  });
}
