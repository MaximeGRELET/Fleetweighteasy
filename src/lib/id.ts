import { randomUUID } from 'expo-crypto';

/**
 * Génère un identifiant d'entité.
 *
 * UUID v4 généré côté client : les identifiants restent valides quand la
 * synchro serveur arrivera (Phase 9), sans renumérotation ni collision entre
 * appareils.
 */
export function createId(): string {
  return randomUUID();
}
