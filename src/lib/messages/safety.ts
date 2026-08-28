import { weeklyRateToDeficitKcal, type CalorieTargetResult } from '@/domain/nutrition/energy';
import type { MacroResult } from '@/domain/nutrition/macros';
import type { ExplanationKey } from '@/domain/nutrition/calories-sport';
import { MAX_DAILY_DEFICIT_KCAL } from '@/domain/nutrition/safety';
import { formatKcal, formatWeeklyRate } from '@/lib/format';

/**
 * Traduction des garde-fous du domaine en langage clair.
 *
 * Le domaine lève des drapeaux ; c'est ici qu'ils deviennent des phrases. Règle
 * absolue (PHASE_1 §5.3) : **aucun ajustement silencieux**. Un objectif borné
 * s'affiche toujours accompagné de son explication.
 *
 * Ton : informatif et bienveillant. On explique une décision prise pour la
 * santé de la personne, on ne la réprimande pas et on ne dramatise pas.
 */
export interface Explanation {
  id: string;
  title: string;
  body: string;
  tone: 'neutral' | 'caution';
}

/**
 * Avertissements déjà couverts par le message d'un ajustement : les afficher en
 * plus ferait doublon. Chaque paire est vérifiée par les tests.
 */
const WARNINGS_COVERED_BY_ADJUSTMENT = {
  aggressive_rate_requested: 'rate_capped',
  target_below_healthy_floor: 'floor_applied',
} as const;

export function explainCalorieTarget(result: CalorieTargetResult): Explanation[] {
  const explanations: Explanation[] = [];

  if (result.adjustments.includes('rate_capped')) {
    explanations.push({
      id: 'rate_capped',
      tone: 'caution',
      title: 'Ton rythme a été ajusté',
      body:
        `Le rythme que tu visais dépassait ce qui est raisonnable pour ton poids actuel. ` +
        `Au-delà d’environ 1 % du poids du corps par semaine, on perd surtout du muscle, ` +
        `pas de la graisse. On est donc parti sur ${formatWeeklyRate(result.effectiveWeeklyRateKg)}, ` +
        `un rythme que ton corps encaisse bien.`,
    });
  }

  if (result.adjustments.includes('deficit_capped')) {
    explanations.push({
      id: 'deficit_capped',
      tone: 'neutral',
      title: 'Ton déficit est plafonné',
      body:
        `On ne creuse jamais plus de ${formatKcal(MAX_DAILY_DEFICIT_KCAL)} par jour sous ta ` +
        `dépense. Au-delà, on fatigue, on a faim en permanence et on perd du muscle, sans ` +
        `accélérer durablement la perte de graisse.`,
    });
  }

  if (result.adjustments.includes('floor_applied')) {
    explanations.push(buildFloorExplanation(result));
  }

  if (result.warnings.includes('goal_leads_to_underweight')) {
    explanations.push({
      id: 'goal_leads_to_underweight',
      tone: 'caution',
      title: 'Ton poids cible est très bas',
      body:
        `Le poids que tu as indiqué correspond à une corpulence sous le seuil considéré comme sain. ` +
        `On ne va pas t’encourager dans cette direction, et on préfère te le dire franchement. ` +
        `Si cet objectif te tient à cœur, parles-en à un médecin ou à un diététicien : ` +
        `c’est le genre de décision qui mérite un avis professionnel.`,
    });
  }

  return explanations;
}

/**
 * Le plancher calorique s'applique **sur tous les chemins**, y compris au
 * maintien et en recomposition. Pour un profil à très faible dépense, l'objectif
 * peut alors ressortir au-dessus de la dépense estimée : sans explication, cela
 * ressemble à un bug.
 */
function buildFloorExplanation(result: CalorieTargetResult): Explanation {
  const targetIsAboveExpenditure = result.appliedDeficitKcal < 0;

  if (targetIsAboveExpenditure) {
    return {
      id: 'floor_applied_above_expenditure',
      tone: 'caution',
      title: 'Ton objectif est fixé un peu plus haut, volontairement',
      body:
        `Ta dépense estimée est de ${formatKcal(result.tdeeKcal)} par jour, et ton objectif est ` +
        `fixé à ${formatKcal(result.targetKcal)} : c’est bien plus haut, et c’est voulu. ` +
        `En dessous de ce seuil, il devient difficile de couvrir ses besoins en vitamines, ` +
        `minéraux et protéines. On préfère te placer dans une zone sûre pour ta santé plutôt ` +
        `que de viser un chiffre plus bas. Si tu veux aller plus loin, fais-le accompagner ` +
        `par un professionnel de santé.`,
    };
  }

  return {
    id: 'floor_applied',
    tone: 'caution',
    title: 'Ton objectif a été relevé au seuil de sécurité',
    body:
      `Le calcul aboutissait à un objectif trop bas. On l’a remonté à ` +
      `${formatKcal(result.targetKcal)}, le minimum en dessous duquel on ne descend pas sans ` +
      `suivi médical. Ta perte sera un peu plus lente — environ ` +
      `${formatWeeklyRate(result.effectiveWeeklyRateKg)} — mais bien plus tenable.`,
  };
}

/**
 * Explique, pendant le réglage du rythme, l'écart entre ce que l'utilisateur
 * pointe et ce que son corps encaissera réellement.
 *
 * Sans ce message, déplacer le curseur dans sa moitié haute ne changerait rien
 * à l'écran : le déficit est écrêté par le domaine, et l'utilisateur croirait à
 * une perte qui ne se produira pas.
 *
 * Toutes les valeurs viennent de `CalorieTargetResult` ou des fonctions du
 * domaine — le seuil d'écrêtage dépend du poids, il n'y a donc aucune constante
 * d'écran à comparer.
 */
export function explainRateSelection(input: {
  requestedWeeklyRateKg: number;
  result: CalorieTargetResult;
}): Explanation[] {
  const { requestedWeeklyRateKg, result } = input;
  const explanations: Explanation[] = [];

  const isClipped =
    result.adjustments.includes('deficit_capped') || result.adjustments.includes('rate_capped');

  // Un déficit appliqué négatif signifie que le plancher a pris le dessus :
  // parler d'une « limite » du déficit n'aurait alors aucun sens, et le message
  // de plancher ci-dessous dit déjà ce qu'il faut.
  if (isClipped && result.appliedDeficitKcal > 0) {
    explanations.push({
      id: 'rate_clipped',
      tone: 'caution',
      title: 'Ce rythme ne sera pas atteint',
      body:
        `À ce rythme, le déficit serait de ` +
        `${formatKcal(weeklyRateToDeficitKcal(requestedWeeklyRateKg))} par jour. Pour préserver ` +
        `ta santé, on le limite à ${formatKcal(result.appliedDeficitKcal)}, donc ta perte réelle ` +
        `sera d'environ ${formatWeeklyRate(result.effectiveWeeklyRateKg)}.`,
    });
  }

  // Le plancher calorique peut réduire le rythme réel bien davantage encore.
  for (const explanation of explainCalorieTarget(result)) {
    if (explanation.id.startsWith('floor_applied')) {
      explanations.push(explanation);
    }
  }

  return explanations;
}

/** Traduit les ajustements de la répartition des macros. */
export function explainMacros(macros: MacroResult): Explanation[] {
  return macros.adjustments.map((adjustment) => {
    if (adjustment === 'protein_reduced') {
      return {
        id: 'protein_reduced',
        tone: 'neutral' as const,
        title: 'Protéines revues à la baisse',
        body:
          `Ton objectif calorique ne permet pas d’atteindre la cible protéique habituelle tout en ` +
          `gardant assez de lipides. On a donné la priorité aux lipides, indispensables au ` +
          `fonctionnement hormonal.`,
      };
    }

    return {
      id: 'macro_floors_unreachable',
      tone: 'caution' as const,
      title: 'Répartition contrainte',
      body:
        `Ton objectif calorique est trop bas pour couvrir confortablement les besoins minimaux ` +
        `en protéines et en lipides pour ton poids. La répartition proposée fait au mieux ; ` +
        `c’est un cas qui mérite l’avis d’un professionnel de santé.`,
    };
  });
}

/** Explication des deux modes de gestion des calories sport. */
export const CALORIE_MODE_EXPLANATIONS: Record<ExplanationKey, Explanation> = {
  fixed_mode: {
    id: 'fixed_mode',
    tone: 'neutral',
    title: 'Objectif fixe',
    body:
      `Ton objectif ne bouge pas les jours où tu fais du sport. Ton niveau d’activité est déjà ` +
      `pris en compte dans le calcul, et les estimations de calories brûlées sont souvent ` +
      `généreuses : les recréditer conduit fréquemment à manger plus que prévu. Tes séances ` +
      `restent enregistrées et visibles.`,
  },
  credited_mode: {
    id: 'credited_mode',
    tone: 'neutral',
    title: 'Calories recréditées',
    body:
      `Les calories estimées de tes séances s’ajoutent à ton budget du jour. C’est plus ` +
      `intuitif, mais l’estimation de la dépense sportive est imprécise et souvent surévaluée : ` +
      `la perte de poids peut s’en trouver ralentie.`,
  },
};

/**
 * Note affichée à côté du champ `sex`.
 * Le champ sert uniquement au calcul métabolique (PHASE_1 §9).
 */
export const SEX_FIELD_NOTE =
  'Les équations métaboliques utilisées reposent sur le sexe biologique. Cette information sert ' +
  'uniquement à calculer ta dépense énergétique — elle ne dit rien de ton identité de genre.';

/** Ce qui doit être dit avant toute collecte de données de santé (RGPD). */
export const CONSENT_POINTS = [
  'Les données collectées sont ton sexe biologique, ta date de naissance, ta taille, ton poids et ton objectif.',
  'Elles servent uniquement à calculer tes besoins et à personnaliser tes conseils.',
  'Elles restent sur cet appareil. Aucune synchronisation n’est active à ce stade.',
  'Tu peux les exporter ou les supprimer définitivement à tout moment depuis les réglages.',
];

export { WARNINGS_COVERED_BY_ADJUSTMENT };
