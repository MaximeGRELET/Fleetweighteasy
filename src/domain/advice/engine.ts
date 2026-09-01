import type { CalorieTargetResult } from '@/domain/nutrition/energy';
import type { RiskSignal } from '@/domain/nutrition/safety';
import type { UserProfile } from '@/domain/profile/types';

import { ADVICE_BLOCKS } from './content';
import { isOwnedElsewhere, matchesTags, profileTags, satisfiesCondition } from './rules';
import type { AdviceBlock, AdviceContext, AdviceSelection, SafetyNoticeKey } from './types';

/**
 * Moteur de conseils.
 *
 * Déterministe par construction : aucune horloge, aucun aléa, aucune lecture
 * externe. Mêmes profil et contexte, mêmes conseils — c'est ce qui rend la
 * sélection testable exhaustivement, et ce qui évite qu'un utilisateur voie le
 * conseil changer sous ses yeux sans que rien n'ait bougé.
 *
 * ## La bande de sécurité passe devant
 *
 * Un garde-fou de santé occupe le conseil du jour ; les briques restent
 * accessibles en dessous. C'est le seul ordre défendable : un conseil sur
 * l'hydratation ne doit pas s'afficher au-dessus d'une mise en garde sur un
 * poids cible dangereux.
 *
 * Le moteur ne rédige **aucune** de ces mises en garde : il désigne des
 * drapeaux, que `lib/messages/safety.ts` traduit — le module qui sert déjà à
 * l'onboarding. Sans cette indirection, la même mise en garde existerait en
 * deux exemplaires, et le jour où l'une serait corrigée, l'autre mentirait.
 */

export interface AdviceSafetyInput {
  /** Objectif calorique courant, d'où sont lus les garde-fous déjà déclenchés. */
  target: CalorieTargetResult;
  /**
   * Signaux de risque comportementaux (PHASE_1 §5.5).
   *
   * Leur détection existe depuis la Phase 1 mais reste sans source de données :
   * elle demande un historique des objectifs successifs, qu'aucune table ne
   * conserve encore. Le paramètre existe pour que la bande soit complète et
   * éprouvée ; l'appelant passe une liste vide tant que cet historique n'est
   * pas persisté.
   */
  riskSignals?: readonly RiskSignal[];
}

/**
 * Ordre de gravité des garde-fous.
 *
 * Du plus grave au moins grave, et non par ordre d'apparition : un objectif
 * menant à l'insuffisance pondérale doit passer devant l'annonce d'un plancher
 * calorique, qui est une protection **déjà appliquée** et donc rassurante.
 */
const SAFETY_NOTICE_ORDER: readonly SafetyNoticeKey[] = [
  'goal_leads_to_underweight',
  'underweight_target_requested',
  'repeated_sub_floor_targets',
  'repeatedly_lowered_target_weight',
  'persistent_maximum_rate',
  'floor_applied',
];

export function selectAdvice(input: {
  profile: UserProfile;
  context: AdviceContext;
  safety?: AdviceSafetyInput;
}): AdviceSelection {
  const safety = collectSafetyNotices(input.safety);
  const blocks = selectBlocks(input.profile, input.context);

  return {
    safety,
    blocks,
    // Un garde-fou occupe la place : mettre en avant un conseil général
    // au-dessus d'une mise en garde de santé inverserait la hiérarchie.
    featured: safety.length > 0 ? undefined : blocks[0],
  };
}

/**
 * Briques retenues, une par topic, de la plus prioritaire à la moins.
 *
 * Exporté pour la « section conseils », qui présente le même choix que le
 * conseil du jour — la section et la mise en avant ne peuvent donc pas
 * diverger.
 */
export function selectBlocks(profile: UserProfile, context: AdviceContext): AdviceBlock[] {
  const tags = profileTags(profile, context);

  const eligible = ADVICE_BLOCKS.filter(
    (block) =>
      !isOwnedElsewhere(block.topic) &&
      matchesTags(block, tags) &&
      satisfiesCondition(block, context),
  );

  // Un seul texte par thème : deux briques du même topic diraient deux fois la
  // même chose sous deux angles, ce qui dilue au lieu d'informer.
  const bestByTopic = new Map<string, AdviceBlock>();

  for (const block of eligible) {
    const current = bestByTopic.get(block.topic);

    if (!current || block.priority > current.priority) {
      bestByTopic.set(block.topic, block);
    }
  }

  // Aucun départage secondaire n'est nécessaire : deux topics ne partagent
  // jamais la même priorité, invariant vérifié sur le contenu lui-même. C'est
  // là qu'il se maintient — un départage par identifiant masquerait une
  // collision au lieu de la signaler à qui ajoute une brique.
  return [...bestByTopic.values()].sort((a, b) => b.priority - a.priority);
}

/**
 * Garde-fous actifs, dédoublonnés et triés par gravité.
 *
 * Seuls figurent ici les garde-fous qui décrivent un **état durable**. Ceux qui
 * commentent une décision ponctuelle — rythme plafonné, déficit plafonné — ont
 * été expliqués au moment où l'utilisateur les a provoqués, sur l'écran de
 * réglage du rythme. Les répéter chaque jour serait du harcèlement, ce que la
 * spécification exclut explicitement (PHASES_6_A_10 §6.6).
 */
function collectSafetyNotices(safety: AdviceSafetyInput | undefined): SafetyNoticeKey[] {
  if (!safety) {
    return [];
  }

  const notices = new Set<SafetyNoticeKey>();

  if (safety.target.adjustments.includes('floor_applied')) {
    notices.add('floor_applied');
  }

  if (safety.target.warnings.includes('goal_leads_to_underweight')) {
    notices.add('goal_leads_to_underweight');
  }

  for (const signal of safety.riskSignals ?? []) {
    notices.add(signal);
  }

  // `underweight_target_requested` est l'écho historique de
  // `goal_leads_to_underweight`, qui décrit le même objectif au présent.
  // Afficher les deux reviendrait à dire deux fois la même chose.
  if (notices.has('goal_leads_to_underweight')) {
    notices.delete('underweight_target_requested');
  }

  return SAFETY_NOTICE_ORDER.filter((key) => notices.has(key));
}
