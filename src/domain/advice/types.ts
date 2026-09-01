import type { RiskSignal } from '@/domain/nutrition/safety';

/**
 * Modèle du moteur de conseils (Phase 6).
 *
 * Unions strictes plutôt que chaînes libres : une faute de frappe dans un tag
 * deviendrait sinon une brique silencieusement jamais affichée — le pire mode
 * de panne pour du contenu, puisque rien ne casse.
 */

/** Un thème de conseil. Au plus une brique par topic est retenue à la fois. */
export type AdviceTopic =
  | 'understanding_deficit'
  | 'protein'
  | 'plateau'
  | 'hunger_satiety'
  | 'hydration'
  | 'sleep'
  | 'alcohol'
  | 'weekends_slips'
  | 'weight_vs_fat'
  | 'recovery_after_slip'
  | 'recomposition'
  | 'resistance_training'
  | 'cardio_progression'
  | 'weighing_fluctuations'
  | 'getting_started';

/**
 * Un critère portant sur le **profil**, stable d'un jour à l'autre.
 *
 * Une brique est candidate si **tous** ses tags correspondent (ET logique) ;
 * une brique sans tag s'adresse à tout le monde.
 */
export type AdviceTag =
  | 'goal:weight_loss'
  | 'goal:recomposition'
  | 'goal:maintenance'
  | 'diet:omnivore'
  | 'diet:flexitarian'
  | 'diet:pescatarian'
  | 'diet:vegetarian'
  | 'diet:vegan'
  | 'trains:strength'
  | 'trains:cardio'
  | 'trains:none'
  | 'activity:low'
  | 'activity:moderate'
  | 'activity:high'
  | 'user:new'
  | 'user:established';

/**
 * La **situation courante**, par opposition au profil.
 *
 * Tout est fourni par l'appelant : le domaine ne lit rien et n'horodate rien,
 * ce qui rend la sélection reproductible à l'identique en test.
 */
export interface AdviceContext {
  /** Usage encore récent de l'application. */
  isNewUser: boolean;
  daysSinceStart: number;
  /** Phase 5 : la tendance ne descend plus malgré le déficit. */
  plateauDetected: boolean;
  /** Dépassement marqué du budget sur les jours récents. */
  recentSlipDetected: boolean;
  weightTrend: 'down' | 'stable' | 'up' | 'insufficient_data';
  /** Nombre d'entrées de journal saisies aujourd'hui. */
  loggedTodayCount: number;
  hasWeighedThisWeek: boolean;
}

/**
 * Condition d'affichage portant sur le contexte.
 *
 * `requires` est un sous-ensemble d'`AdviceContext` : chaque champ présent doit
 * être égal à la valeur du contexte. Une brique sans condition est toujours
 * éligible.
 */
export interface AdviceCondition {
  requires?: Partial<AdviceContext>;
}

export interface AdviceBlock {
  id: string;
  topic: AdviceTopic;
  tags: readonly AdviceTag[];
  /** Plus élevé = retenu en priorité en cas de conflit. */
  priority: number;
  title: string;
  body: string;
  /** Références scientifiques, affichées pour la crédibilité du propos. */
  sources?: readonly string[];
  condition?: AdviceCondition;
}

/**
 * Garde-fou de sécurité actif, exposé par **référence** et non par son texte.
 *
 * Le moteur ne rédige pas : il désigne un drapeau, que
 * `lib/messages/safety.ts` traduit — le même module que celui utilisé par
 * l'onboarding. Sans cette indirection, la même mise en garde existerait en
 * deux exemplaires, qui divergeraient à la première correction.
 */
export type SafetyNoticeKey = 'floor_applied' | 'goal_leads_to_underweight' | RiskSignal;

export interface AdviceSelection {
  /**
   * Garde-fous actifs, du plus grave au moins grave.
   *
   * Ils occupent le conseil du jour : une mise en garde de santé passe devant
   * un conseil général, toujours.
   */
  safety: readonly SafetyNoticeKey[];
  /** Briques retenues, une par topic, triées par priorité décroissante. */
  blocks: readonly AdviceBlock[];
  /**
   * Brique mise en avant.
   *
   * `undefined` quand un garde-fou occupe la place, ou qu'aucune brique n'est
   * pertinente. La règle vit ici pour que deux écrans ne puissent pas en
   * arbitrer différemment.
   */
  featured?: AdviceBlock;
}
