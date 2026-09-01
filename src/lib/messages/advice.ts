import type { SafetyNoticeKey } from '@/domain/advice/types';
import type { CalorieTargetResult } from '@/domain/nutrition/energy';
import type { RiskSignal } from '@/domain/nutrition/safety';

import { explainCalorieTarget, type Explanation } from './safety';

/**
 * Mise en mots de la bande de sécurité du moteur de conseils.
 *
 * Le moteur désigne des drapeaux ; ce module les traduit. Pour les garde-fous
 * déjà expliqués à l'onboarding — plancher calorique, poids cible sous le seuil
 * sain — **le texte n'est pas réécrit** : il est repris tel quel de
 * `explainCalorieTarget`. Une mise en garde de santé rédigée deux fois finirait
 * corrigée une fois sur deux.
 */

/**
 * Signaux de risque comportementaux (PHASE_1 §5.5).
 *
 * Détectés depuis la Phase 1, jamais affichés jusqu'ici faute de surface. Ce
 * sont les seuls textes que ce module rédige, et ils suivent une règle stricte :
 * on nomme le schéma observé, on ne diagnostique rien, on n'encourage jamais
 * l'objectif, et on oriente vers un professionnel. Le ton reste celui d'une
 * remarque prudente entre adultes — pas d'une alarme.
 */
const RISK_SIGNAL_EXPLANATIONS: Record<RiskSignal, Explanation> = {
  repeated_sub_floor_targets: {
    id: 'risk_repeated_sub_floor_targets',
    tone: 'caution',
    title: 'Tes objectifs reviennent souvent sous le seuil de sécurité',
    body:
      'À plusieurs reprises, le calcul a dû relever ton objectif pour rester au-dessus du ' +
      'minimum en dessous duquel on ne descend pas sans suivi médical. Ce n’est pas un reproche : ' +
      'c’est une observation, et elle mérite d’être partagée avec un médecin ou un diététicien, ' +
      'qui pourra t’accompagner mieux qu’une application.',
  },

  repeatedly_lowered_target_weight: {
    id: 'risk_repeatedly_lowered_target_weight',
    tone: 'caution',
    title: 'Ton poids cible a été revu à la baisse plusieurs fois',
    body:
      'Tu as abaissé ton objectif de poids à plusieurs reprises. C’est parfois un simple ' +
      'ajustement, et parfois le signe qu’une cible recule à mesure qu’on s’en approche. Si tu ' +
      'reconnais la seconde situation, en parler à un professionnel de santé est ce qu’il y a de ' +
      'plus utile à faire.',
  },

  persistent_maximum_rate: {
    id: 'risk_persistent_maximum_rate',
    tone: 'caution',
    title: 'Tu vises systématiquement le rythme maximal',
    body:
      'Tes réglages poussent régulièrement la perte à la limite haute de ce qui est raisonnable. ' +
      'Aller vite est tentant, mais c’est aussi ce qui fatigue, entretient la faim et fait perdre ' +
      'du muscle. Un rythme plus modéré donne de meilleurs résultats à l’arrivée — et si ' +
      'l’envie d’accélérer est difficile à contenir, un professionnel de santé est la bonne ' +
      'personne à qui en parler.',
  },

  underweight_target_requested: {
    id: 'risk_underweight_target_requested',
    tone: 'caution',
    title: 'Ton objectif de poids a été fixé sous le seuil sain',
    body:
      'Tu as demandé un poids cible correspondant à une corpulence sous le seuil considéré comme ' +
      'sain. On ne t’encouragera pas dans cette direction, et on préfère te le dire clairement ' +
      'plutôt que de l’ignorer. C’est le genre de décision qui mérite l’avis d’un médecin ou ' +
      'd’un diététicien.',
  },
};

/**
 * Traduit les garde-fous retenus par le moteur, dans l'ordre qu'il a fixé.
 *
 * L'ordre vient du domaine et n'est pas retouché ici : la gravité relative de
 * deux mises en garde est une décision métier, pas une décision d'affichage.
 */
export function explainAdviceSafety(input: {
  notices: readonly SafetyNoticeKey[];
  target: CalorieTargetResult;
}): Explanation[] {
  const fromTarget = collectTargetExplanations(input.target);

  return input.notices.flatMap((notice) => {
    if (notice === 'floor_applied' || notice === 'goal_leads_to_underweight') {
      // Absent si l'appelant a transmis un drapeau que l'objectif ne porte pas :
      // on n'invente alors aucun message plutôt que d'en afficher un faux.
      const explanation = fromTarget.get(notice);
      return explanation ? [explanation] : [];
    }

    return [RISK_SIGNAL_EXPLANATIONS[notice]];
  });
}

/**
 * Indexe les explications de l'objectif par le drapeau qu'elles couvrent.
 *
 * Le plancher a deux rédactions selon qu'il relève l'objectif au-dessus ou en
 * dessous de la dépense estimée ; les deux portent un identifiant préfixé
 * `floor_applied`, et c'est ce préfixe qu'on suit plutôt que de refaire le
 * choix entre elles.
 */
function collectTargetExplanations(target: CalorieTargetResult): Map<SafetyNoticeKey, Explanation> {
  const indexed = new Map<SafetyNoticeKey, Explanation>();

  for (const explanation of explainCalorieTarget(target)) {
    if (explanation.id.startsWith('floor_applied')) {
      indexed.set('floor_applied', explanation);
    }

    if (explanation.id === 'goal_leads_to_underweight') {
      indexed.set('goal_leads_to_underweight', explanation);
    }
  }

  return indexed;
}
