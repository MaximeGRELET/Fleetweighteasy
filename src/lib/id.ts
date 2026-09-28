import { randomUUID } from 'expo-crypto';

/**
 * Génère un identifiant d'entité.
 *
 * UUID v4 généré côté client : les identifiants resteraient valides si une
 * synchro entre appareils voyait le jour, et un import de sauvegarde ne peut
 * pas entrer en collision avec des données existantes.
 */
export function createId(): string {
  return randomUUID();
}
