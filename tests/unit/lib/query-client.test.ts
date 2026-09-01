import { FoodSourceError } from '@/data/remote/types';
import { createAppQueryClient } from '@/lib/query-client';

/**
 * Politique de requêtes.
 *
 * Ces réglages ne sont pas cosmétiques : ce sont eux qui décident si un écran
 * peut rester bloqué sans réseau, et combien d'appels partent vers un service
 * qui applique des quotas.
 */
describe('createAppQueryClient', () => {
  const defaults = () => createAppQueryClient().getDefaultOptions().queries;

  it('ne met jamais une requête en pause faute de réseau', () => {
    // En mode « online », TanStack Query suspend les requêtes quand il se croit
    // hors ligne — et sans détecteur réseau branché, cette croyance n'est pas
    // fiable. Une requête suspendue, c'est un indicateur de chargement qui ne
    // se résout jamais : le « spinner bloqué » interdit par PHASES_2_A_5 §4.7.
    expect(defaults()?.networkMode).toBe('always');
  });

  it('laisse une fiche produit au chaud plusieurs minutes', () => {
    // Refaire le même appel en revenant sur un écran serait le meilleur moyen
    // d'approcher le quota Open Food Facts pour rien.
    expect(defaults()?.staleTime).toBeGreaterThanOrEqual(60_000);
  });

  describe('réessais', () => {
    const shouldRetry = (failureCount: number, error: Error): boolean => {
      const retry = defaults()?.retry;
      return typeof retry === 'function' ? retry(failureCount, error) : false;
    };

    it('relance une panne passagère', () => {
      expect(shouldRetry(0, new FoodSourceError('timeout', 'x'))).toBe(true);
      expect(shouldRetry(0, new FoodSourceError('unavailable', 'x'))).toBe(true);
    });

    it('ne relance pas ce qui échouerait à l’identique', () => {
      // Insister sur un quota atteint ne fait que l'aggraver ; insister sans
      // réseau ne fait qu'allonger l'attente avant le message.
      expect(shouldRetry(0, new FoodSourceError('rate_limited', 'x'))).toBe(false);
      expect(shouldRetry(0, new FoodSourceError('offline', 'x'))).toBe(false);
      expect(shouldRetry(0, new FoodSourceError('not_configured', 'x'))).toBe(false);
    });

    it('finit par abandonner, plutôt que de boucler', () => {
      expect(shouldRetry(2, new FoodSourceError('timeout', 'x'))).toBe(false);
    });
  });
});
