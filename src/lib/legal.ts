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

/**
 * Avertissement sport, à afficher partout où l'app propose un exercice ou un
 * programme (DONNEES_SPORT, note de sécurité).
 *
 * Distinct du disclaimer santé : il ne s'agit pas ici d'un chiffre, mais d'un
 * mouvement à exécuter. Tant que les consignes d'exécution ne sont pas
 * rédigées, c'est le seul repère de sécurité affiché — raison de plus pour
 * qu'il soit explicite sur la charge et sur la douleur.
 */
export const SPORT_DISCLAIMER =
  'Adapte les charges et l’intensité à ton niveau, et progresse graduellement. En cas de douleur, ' +
  'd’essoufflement inhabituel ou de condition médicale particulière, demande l’avis d’un ' +
  'professionnel avant de poursuivre.';
