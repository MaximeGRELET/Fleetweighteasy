import { FoodSourceError } from './types';

/**
 * Client HTTP des sources alimentaires.
 *
 * Existe pour une raison précise : Open Food Facts **exige** un User-Agent
 * identifiant l'application, et une requête sans lui risque le blocage
 * (PHASES_2_A_5 §4.2). Le centraliser ici est la seule façon de garantir qu'il
 * accompagne chaque appel — un `fetch` écrit à la main dans un écran l'oublierait.
 *
 * Le client traduit aussi les pannes en `FoodSourceError` : au-delà, plus
 * personne ne manipule de statut HTTP.
 */

/** Au-delà, l'utilisateur a déjà conclu que ça ne marchait pas. */
export const DEFAULT_TIMEOUT_MS = 8_000;

export interface HttpClientOptions {
  /**
   * User-Agent complet, de la forme `Nom/version (contact)`.
   *
   * Sur le web, le navigateur interdit de fixer cet en-tête et le retire
   * silencieusement : ce chemin ne concerne que le développement.
   */
  userAgent: string;
  timeoutMs?: number;
  /** `fetch` injecté : aucun test ne touche le réseau. */
  fetchImpl?: typeof fetch;
}

export interface HttpClient {
  getJson<T>(url: string, options?: { signal?: AbortSignal }): Promise<T>;
}

/** Statut renvoyé par Open Food Facts quand le quota est dépassé. */
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_NOT_FOUND = 404;

/** Erreur portant un 404, pour que l'appelant distingue « absent » de « en panne ». */
export class HttpNotFoundError extends Error {
  readonly code = 'http_not_found';

  constructor(url: string) {
    super(`Ressource absente : ${url}`);
    this.name = 'HttpNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async getJson<T>(url: string, callOptions: { signal?: AbortSignal } = {}): Promise<T> {
      // Un `fetch` sans délai maximal peut pendre indéfiniment sur un réseau
      // captif — le cas typique d'un Wi-Fi d'hôtel qui accepte la connexion
      // mais ne répond jamais.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const abortFromCaller = () => controller.abort();

      callOptions.signal?.addEventListener('abort', abortFromCaller);

      let response: Response;

      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: {
            // Obligatoire : sans lui, Open Food Facts peut bloquer l'app.
            'User-Agent': options.userAgent,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
      } catch (error) {
        // Une annulation demandée par l'appelant n'est pas une panne : elle doit
        // remonter telle quelle pour que TanStack Query l'ignore.
        if (callOptions.signal?.aborted) {
          throw error;
        }

        throw controller.signal.aborted
          ? new FoodSourceError('timeout', `Délai dépassé sur ${url}.`)
          : new FoodSourceError('offline', `Réseau injoignable pour ${url}.`);
      } finally {
        clearTimeout(timeout);
        callOptions.signal?.removeEventListener('abort', abortFromCaller);
      }

      if (response.status === HTTP_NOT_FOUND) {
        throw new HttpNotFoundError(url);
      }

      if (response.status === HTTP_TOO_MANY_REQUESTS) {
        throw new FoodSourceError('rate_limited', `Quota distant atteint sur ${url}.`, 429);
      }

      if (!response.ok) {
        throw new FoodSourceError(
          'unavailable',
          `Réponse ${response.status} sur ${url}.`,
          response.status,
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new FoodSourceError('malformed', `Réponse illisible sur ${url}.`, response.status);
      }
    },
  };
}
