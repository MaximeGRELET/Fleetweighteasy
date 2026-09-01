import type { FoodItem } from '@/domain/food/types';

/**
 * Source distante de données alimentaires.
 *
 * **Toute** la connaissance d'Open Food Facts vit derrière cette interface. Ni
 * l'UI, ni les hooks, ni les repositories ne savent d'où viennent les aliments :
 * ils voient des `FoodItem`, le type du domaine.
 *
 * C'est la condition pour pouvoir changer de source — USDA, base maison, API
 * commerciale si l'ODbL devient contraignante (PHASES_2_A_5 §4.5) — en
 * implémentant cette seule interface, sans toucher au reste de l'app.
 */
export interface FoodDataSource {
  /**
   * Produit correspondant à un code-barres.
   *
   * @returns `null` quand la source ne connaît pas ce code — un cas normal, pas
   *   une erreur : la réponse est « ce produit n'existe pas chez nous », et
   *   l'app propose alors la saisie manuelle.
   * @throws {FoodSourceError} quand la source n'a pas pu répondre (réseau,
   *   quota, panne). Un `null` et une panne réseau appellent deux messages très
   *   différents : les confondre ferait proposer une saisie manuelle à
   *   quelqu'un qui a juste perdu la 4G dans un tunnel.
   */
  getByBarcode(barcode: string, options?: FoodDataSourceOptions): Promise<FoodItem | null>;

  /**
   * Recherche plein texte.
   *
   * @returns une liste éventuellement vide — « rien trouvé » n'est pas une
   *   erreur non plus.
   * @throws {FoodSourceError} dans les mêmes conditions que `getByBarcode`.
   */
  searchByName(query: string, options?: FoodSearchOptions): Promise<FoodItem[]>;
}

export interface FoodDataSourceOptions {
  /** Annulation : une recherche abandonnée ne doit pas consommer de quota. */
  signal?: AbortSignal;
}

export interface FoodSearchOptions extends FoodDataSourceOptions {
  /** Nombre maximal de résultats souhaités. */
  limit?: number;
}

/**
 * Pourquoi la source n'a pas pu répondre.
 *
 * Chaque motif appelle une conduite différente côté UI — d'où une énumération
 * plutôt qu'un simple message : `offline` invite au repli sur la saisie
 * manuelle, `rate_limited` invite à réessayer, `malformed` est un bug de notre
 * côté ou un changement de contrat de l'API.
 */
export type FoodSourceFailure =
  /** Requête partie mais jamais arrivée : avion, tunnel, Wi-Fi captif. */
  | 'offline'
  /** Le serveur met trop longtemps. Traité comme une absence de réseau côté UX. */
  | 'timeout'
  /** Quota dépassé — le nôtre (throttling local) ou celui d'Open Food Facts. */
  | 'rate_limited'
  /** La source répond, mais en erreur : panne, maintenance, 5xx. */
  | 'unavailable'
  /** Réponse illisible ou hors contrat : la source a changé sous nos pieds. */
  | 'malformed'
  /**
   * Source inutilisable faute de configuration — en pratique, le contact
   * obligatoire du User-Agent n'est pas renseigné. L'app reste pleinement
   * fonctionnelle sur son cache et ses aliments maison ; seule l'interrogation
   * d'Open Food Facts est fermée. Voir `createAppFoodDataSource`.
   */
  | 'not_configured';

/**
 * Échec d'une source distante.
 *
 * Porte un motif exploitable par l'UI plutôt qu'un texte : la rédaction des
 * messages reste dans `src/lib/messages/`, comme pour les garde-fous du domaine.
 */
export class FoodSourceError extends Error {
  readonly code = 'food_source';
  readonly reason: FoodSourceFailure;
  /** Statut HTTP, quand il y en a eu un. Utile en télémétrie, pas à l'écran. */
  readonly status?: number;

  constructor(reason: FoodSourceFailure, message: string, status?: number) {
    super(message);
    this.name = 'FoodSourceError';
    this.reason = reason;

    if (status !== undefined) {
      this.status = status;
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Vrai pour les échecs qu'une nouvelle tentative peut résoudre. */
export function isRetryableFailure(error: unknown): boolean {
  return (
    error instanceof FoodSourceError &&
    (error.reason === 'timeout' || error.reason === 'unavailable')
  );
}

/**
 * Vrai quand l'échec vient de l'absence de réseau.
 *
 * C'est le seul cas où l'app doit expliquer que la donnée existe peut-être,
 * mais qu'on ne peut pas aller la chercher maintenant.
 */
export function isOfflineFailure(error: unknown): boolean {
  return (
    error instanceof FoodSourceError && (error.reason === 'offline' || error.reason === 'timeout')
  );
}
