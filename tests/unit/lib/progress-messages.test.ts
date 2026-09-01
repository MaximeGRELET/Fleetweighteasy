import { evaluateAdaptiveTarget, type AdaptiveEvaluation } from '@/domain/progress/adaptive';
import type { ObservedRate } from '@/domain/progress/rate';
import type { ProgressSummary } from '@/domain/progress/summary';
import type { ProgressStatus } from '@/domain/progress/types';
import { formatKcal, formatKg, formatWeeklyRate } from '@/lib/format';
import {
  explainAdaptiveAdjustment,
  explainProgressStatus,
  TREND_NOT_ESTABLISHED,
  WEIGHING_GUIDANCE,
} from '@/lib/messages/progress';

import { buildProfile, NOW } from '../profile-fixtures';

/** Tous les statuts du domaine, pour le test de balayage. */
const ALL_STATUSES: ProgressStatus[] = [
  'insufficient_data',
  'faster_than_safe',
  'on_track',
  'slower_than_planned',
  'plateau',
  'gaining',
  'unplanned_loss',
];

function buildSummary(
  status: ProgressStatus,
  observed: ObservedRate | undefined = { weeklyRateKg: -0.6, spanDays: 28, entryCount: 12 },
): ProgressSummary {
  return {
    period: 'all',
    range: { toDate: '2026-09-01' },
    points: [],
    trend: [],
    observed,
    plannedWeeklyLossKg: 0.6,
    status,
    changeKg: -2.4,
  };
}

/**
 * Vocabulaire proscrit.
 *
 * Le ton n'est pas un détail de rédaction : c'est une exigence de la phase
 * (PHASES_2_A_5 §5.2). Un test le rend vérifiable plutôt que déclaratif.
 */
const BLAMING_WORDS = [
  'échoué',
  'tu as raté',
  'faute',
  'coupable',
  'tu dois',
  'il faut que tu',
  'manque de discipline',
  'triché',
  'laisser aller',
];

describe('explainProgressStatus — balayage', () => {
  it.each(ALL_STATUSES)('produit un message pour le statut « %s »', (status) => {
    const explanation = explainProgressStatus(buildSummary(status, observedFor(status)));

    expect(explanation.id).toBeTruthy();
    expect(explanation.title.length).toBeGreaterThan(0);
    expect(explanation.body.length).toBeGreaterThan(60);
    expect(['neutral', 'caution']).toContain(explanation.tone);
  });

  it.each(ALL_STATUSES)('n’utilise aucun mot culpabilisant pour « %s »', (status) => {
    const { title, body } = explainProgressStatus(buildSummary(status));
    const text = `${title} ${body}`.toLowerCase();

    for (const word of BLAMING_WORDS) {
      expect(text).not.toContain(word);
    }
  });

  it('donne un identifiant distinct à chaque statut', () => {
    const ids = ALL_STATUSES.map((status) => explainProgressStatus(buildSummary(status)).id);

    expect(new Set(ids).size).toBe(ALL_STATUSES.length);
  });
});

/** `insufficient_data` est le seul statut produit sans rythme observé. */
function observedFor(status: ProgressStatus): ObservedRate | undefined {
  return status === 'insufficient_data'
    ? undefined
    : { weeklyRateKg: -0.6, spanDays: 28, entryCount: 12 };
}

describe('explainProgressStatus — contenu', () => {
  it('ne promet aucun rythme tant que les données manquent', () => {
    const explanation = explainProgressStatus(buildSummary('insufficient_data', undefined));

    expect(explanation.body).toMatch(/14 jours/);
    expect(explanation.body).not.toMatch(/kg par semaine/);
  });

  it('cite le rythme réel et le rythme visé quand tout va bien', () => {
    const explanation = explainProgressStatus(buildSummary('on_track'));

    expect(explanation.body).toContain(formatWeeklyRate(0.6));
    expect(explanation.tone).toBe('neutral');
  });

  it('attribue le retard à l’imprécision du modèle, pas à la personne', () => {
    const explanation = explainProgressStatus(buildSummary('slower_than_planned'));

    expect(explanation.body).toMatch(/statistique/);
    expect(explanation.body).toMatch(/10 à 15 %/);
  });

  it('présente le plateau comme une étape banale, sur un ton neutre', () => {
    const explanation = explainProgressStatus(buildSummary('plateau'));

    expect(explanation.body).toMatch(/banale/);
    expect(explanation.body).toMatch(/pas un échec/);
    expect(explanation.tone).toBe('neutral');
  });

  it('énonce une reprise comme un constat, jamais comme un verdict', () => {
    const explanation = explainProgressStatus(
      buildSummary('gaining', { weeklyRateKg: 0.4, spanDays: 28, entryCount: 12 }),
    );

    expect(explanation.body).toContain(formatWeeklyRate(0.4));
    expect(explanation.body).toMatch(/constat/);
    expect(explanation.tone).toBe('neutral');
  });

  it('traite une perte trop rapide comme un signal de santé', () => {
    const explanation = explainProgressStatus(
      buildSummary('faster_than_safe', { weeklyRateKg: -1.4, spanDays: 28, entryCount: 12 }),
    );

    expect(explanation.tone).toBe('caution');
    expect(explanation.body).toMatch(/professionnel de santé/);
    expect(explanation.body).toMatch(/n’est pas un renoncement/);
  });

  it('oriente une perte non voulue vers le niveau d’activité', () => {
    const explanation = explainProgressStatus(
      buildSummary('unplanned_loss', { weeklyRateKg: -0.5, spanDays: 28, entryCount: 12 }),
    );

    expect(explanation.tone).toBe('caution');
    expect(explanation.body).toMatch(/niveau d’activité/);
  });

  it('arrondit la durée en semaines pleines', () => {
    const explanation = explainProgressStatus(
      buildSummary('on_track', { weeklyRateKg: -0.6, spanDays: 30, entryCount: 12 }),
    );

    expect(explanation.body).toMatch(/4 dernières semaines/);
  });
});

describe('explainAdaptiveAdjustment', () => {
  function evaluate(currentWeightKg: number, referenceWeightKg: number): AdaptiveEvaluation {
    return evaluateAdaptiveTarget({
      profile: buildProfile({ currentWeightKg }),
      referenceWeightKg,
      now: NOW,
    });
  }

  it('ne dit rien tant que le profil n’est pas réaligné', () => {
    expect(explainAdaptiveAdjustment(evaluate(80, 79.9))).toEqual([]);
  });

  it('reste silencieux sur un ajustement imperceptible', () => {
    const evaluation = evaluate(80, 79.4);

    expect(evaluation.shouldUpdateProfile).toBe(true);
    expect(evaluation.shouldNotifyUser).toBe(false);
    expect(explainAdaptiveAdjustment(evaluation)).toEqual([]);
  });

  it('explique l’ajustement en citant l’ancien et le nouvel objectif', () => {
    const [explanation] = explainAdaptiveAdjustment(evaluate(90, 80));

    expect(explanation.id).toBe('adaptive_target_updated');
    expect(explanation.body).toContain(formatKcal(2172));
    expect(explanation.body).toContain(formatKcal(2099));
    expect(explanation.body).toContain(formatKcal(2914));
    expect(explanation.body).toContain(formatKcal(2759));
  });

  it('déculpabilise explicitement', () => {
    const [explanation] = explainAdaptiveAdjustment(evaluate(90, 80));

    expect(explanation.body).toMatch(/pas que tu as fait quoi que ce soit de travers/);
  });

  it('formule la hausse de poids sans reproche', () => {
    const [explanation] = explainAdaptiveAdjustment(evaluate(80, 90));

    expect(explanation.body).toContain(`Ton poids a augmenté de ${formatKg(10)}`);
    expect(explanation.body).toMatch(/dépense un peu plus d’énergie/);
    expect(explanation.body).toContain(`+${formatKcal(73)}`);
  });

  it('ajoute le garde-fou qui vient d’apparaître', () => {
    const evaluation = evaluateAdaptiveTarget({
      profile: buildProfile({
        sex: 'female',
        heightCm: 170,
        currentWeightKg: 71,
        activityLevel: 'sedentary',
        goalType: 'weight_loss',
        weeklyRateKg: 0.5,
      }),
      referenceWeightKg: 70,
      now: NOW,
    });

    const ids = explainAdaptiveAdjustment(evaluation).map(({ id }) => id);

    expect(ids).toContain('adaptive_target_updated');
    expect(ids.some((id) => id.startsWith('floor_applied'))).toBe(true);
  });

  it('ne répète pas un garde-fou que l’utilisateur connaissait déjà', () => {
    // Le plancher était déjà appliqué avant le recalcul : le réafficher ferait
    // doublon avec l'écran de restitution.
    const profile = buildProfile({
      sex: 'female',
      heightCm: 155,
      currentWeightKg: 55,
      activityLevel: 'sedentary',
      goalType: 'weight_loss',
      weeklyRateKg: 0.5,
    });

    const evaluation = evaluateAdaptiveTarget({ profile, referenceWeightKg: 48, now: NOW });
    const ids = explainAdaptiveAdjustment(evaluation).map(({ id }) => id);

    expect(evaluation.recalculation?.previous.adjustments).toContain('floor_applied');
    expect(ids.filter((id) => id.startsWith('floor_applied'))).toEqual([]);
  });
});

describe('textes pédagogiques', () => {
  it('explique pourquoi la ligne compte plus que les points', () => {
    expect(WEIGHING_GUIDANCE.body).toMatch(/7 derniers jours/);
    expect(WEIGHING_GUIDANCE.body).toMatch(/une fois par semaine/);
  });

  it('laisse la pesée quotidienne possible plutôt que de l’interdire', () => {
    expect(WEIGHING_GUIDANCE.body).toMatch(/tous les jours\s*\n?\s*fonctionne aussi/);
  });

  it('signale une tendance encore non établie sans alarmer', () => {
    expect(TREND_NOT_ESTABLISHED).toMatch(/se lissera/);
  });
});
