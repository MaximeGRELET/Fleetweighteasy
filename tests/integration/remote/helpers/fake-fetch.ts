/**
 * Faux `fetch` pour les tests de la couche distante.
 *
 * Aucun test ne touche le réseau (PHASES_2_A_5 §4.8) : ce substitut enregistre
 * les requêtes — c'est ce qui permet de vérifier l'en-tête User-Agent, exigé
 * par Open Food Facts — et rejoue des réponses préparées.
 */

export interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
}

export interface FakeFetch {
  /** Implémentation à injecter dans le client HTTP. */
  impl: typeof fetch;
  /** Requêtes effectivement parties, dans l'ordre. */
  requests: RecordedRequest[];
  /** Empile une réponse JSON. */
  queueJson: (body: unknown, status?: number) => void;
  /** Empile un statut nu, sans corps exploitable. */
  queueStatus: (status: number) => void;
  /** Empile un corps qui n'est pas du JSON valide. */
  queueInvalidJson: () => void;
  /** Empile une panne réseau : la requête ne part jamais. */
  queueNetworkFailure: () => void;
  /** Empile une réponse qui n'arrive jamais, pour éprouver le délai maximal. */
  queueHang: () => void;
}

type QueuedResponse =
  | { kind: 'json'; body: unknown; status: number }
  | { kind: 'invalid-json'; status: number }
  | { kind: 'network-failure' }
  | { kind: 'hang' };

export function createFakeFetch(): FakeFetch {
  const queue: QueuedResponse[] = [];
  const requests: RecordedRequest[] = [];

  const impl: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : String(input);
    requests.push({ url, headers: normalizeHeaders(init?.headers) });

    const next = queue.shift() ?? { kind: 'json', body: {}, status: 200 };
    const signal = init?.signal ?? undefined;

    if (next.kind === 'network-failure') {
      return Promise.reject(new TypeError('Network request failed'));
    }

    if (next.kind === 'hang') {
      // Ne se résout jamais d'elle-même : seule l'annulation par délai maximal
      // ou par l'appelant peut en sortir. C'est le Wi-Fi captif du hall d'hôtel.
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }

    if (signal?.aborted === true) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    const status = next.status;
    const body = next.kind === 'json' ? JSON.stringify(next.body) : '<html>pas du json</html>';

    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () =>
        next.kind === 'json' ? Promise.resolve(next.body) : Promise.reject(new SyntaxError(body)),
    } as Response);
  };

  return {
    impl,
    requests,
    queueJson: (body, status = 200) => queue.push({ kind: 'json', body, status }),
    queueStatus: (status) => queue.push({ kind: 'json', body: {}, status }),
    queueInvalidJson: () => queue.push({ kind: 'invalid-json', status: 200 }),
    queueNetworkFailure: () => queue.push({ kind: 'network-failure' }),
    queueHang: () => queue.push({ kind: 'hang' }),
  };
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (headers === undefined) {
    return {};
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  if (typeof (headers as Headers).forEach === 'function' && !isPlainObject(headers)) {
    const collected: Record<string, string> = {};
    (headers as Headers).forEach((value, key) => {
      collected[key] = value;
    });
    return collected;
  }

  return { ...(headers as Record<string, string>) };
}

function isPlainObject(value: unknown): boolean {
  return Object.prototype.toString.call(value) === '[object Object]';
}
