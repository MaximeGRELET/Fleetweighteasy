/**
 * Limiteur de débit côté client.
 *
 * Open Food Facts applique des quotas **par endpoint** (PHASES_2_A_5 §4.2), et
 * un dépassement se paie en blocage, pas en ralentissement. Le debounce de la
 * saisie réduit déjà beaucoup d'appels, mais il ne protège que d'un seul écran :
 * ce limiteur est le garde-fou qui vaut pour tous les chemins, y compris ceux
 * qu'on écrira plus tard.
 *
 * Fenêtre glissante plutôt qu'intervalle minimal fixe : scanner trois produits
 * d'affilée est un usage normal qu'un intervalle fixe rendrait artificiellement
 * lent, alors qu'une fenêtre l'absorbe sans dépasser le quota.
 */

export interface RateLimiterOptions {
  /** Nombre d'appels autorisés dans la fenêtre. */
  maxCalls: number;
  /** Largeur de la fenêtre glissante, en millisecondes. */
  windowMs: number;
  /**
   * Attente maximale avant d'abandonner.
   *
   * Sans ce plafond, un écran pourrait rester sur son indicateur de chargement
   * aussi longtemps que la file est pleine — exactement le « spinner bloqué »
   * que la phase interdit (PHASES_2_A_5 §4.7).
   */
  maxWaitMs: number;
  /** Horloge injectée : les tests ne dépendent pas du temps réel. */
  now?: () => number;
  /** Attente injectée, pour la même raison. */
  sleep?: (durationMs: number) => Promise<void>;
}

export interface RateLimiter {
  /**
   * Réserve un créneau, en attendant si nécessaire.
   *
   * @throws {RateLimitExceededError} si le créneau ne peut pas se libérer dans
   *   `maxWaitMs`.
   */
  acquire(): Promise<void>;
  /** Créneaux encore disponibles dans la fenêtre courante. */
  available(): number;
}

export class RateLimitExceededError extends Error {
  readonly code = 'rate_limit_exceeded';

  constructor(waitMs: number) {
    super(`Quota local atteint : le prochain créneau se libère dans ${waitMs} ms.`);
    this.name = 'RateLimitExceededError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const defaultSleep = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;

  /** Horodatage des appels encore dans la fenêtre, du plus ancien au plus récent. */
  const calls: number[] = [];

  function forget(before: number): void {
    while (calls.length > 0 && calls[0] !== undefined && calls[0] <= before) {
      calls.shift();
    }
  }

  return {
    available() {
      forget(now() - options.windowMs);
      return Math.max(0, options.maxCalls - calls.length);
    },

    async acquire() {
      const startedAt = now();

      // Boucle plutôt que calcul en une passe : plusieurs appels peuvent
      // attendre le même créneau, et seul le premier réveillé doit le prendre.
      for (;;) {
        const current = now();
        forget(current - options.windowMs);

        if (calls.length < options.maxCalls) {
          calls.push(current);
          return;
        }

        const oldest = calls[0] ?? current;
        const freesInMs = Math.max(0, oldest + options.windowMs - current);
        const elapsed = current - startedAt;

        if (elapsed + freesInMs > options.maxWaitMs) {
          throw new RateLimitExceededError(freesInMs);
        }

        // `+ 1` : se réveiller pile à l'échéance retomberait sur la même
        // fenêtre à cause de l'arrondi milliseconde, et boucler pour rien.
        await sleep(freesInMs + 1);
      }
    },
  };
}
