/**
 * Références légales de l'application.
 *
 * `PRIVACY_POLICY_VERSION` est comparée au consentement enregistré : la faire
 * évoluer redemande automatiquement le consentement à l'utilisateur. Elle doit
 * donc changer à chaque modification substantielle de la politique.
 * Le texte complet de la politique est rédigé en Phase 10.
 */
export const PRIVACY_POLICY_VERSION = '2026-01';

/**
 * Avertissement santé, à afficher partout où l'app avance un chiffre ou un
 * conseil (PLAN_IMPLEMENTATION §11.3).
 */
export const HEALTH_DISCLAIMER =
  'Cette application informe et accompagne : elle ne pose aucun diagnostic et ne remplace pas ' +
  'l’avis d’un professionnel de santé.';
