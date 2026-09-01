import {
  assessProgress,
  isPlateau,
  ON_TRACK_RATE_FRACTION,
  PLATEAU_MIN_ENTRIES,
  PLATEAU_MIN_SPAN_DAYS,
  PLATEAU_RATE_FRACTION,
  STABLE_BAND_WEEKLY_KG,
} from '@/domain/progress/assessment';
import type { ObservedRate } from '@/domain/progress/rate';
import type { ProgressStatus } from '@/domain/progress/types';

/** Profil type : perte visée de 0,6 kg/semaine, plafond de sécurité à 0,8. */
const PLANNED = 0.6;
const MAX_SAFE = 0.8;

function observed(weeklyRateKg: number, overrides: Partial<ObservedRate> = {}): ObservedRate {
  return { weeklyRateKg, spanDays: 28, entryCount: 12, ...overrides };
}

function assess(rate: ObservedRate | undefined, planned = PLANNED): ProgressStatus {
  return assessProgress({
    observed: rate,
    plannedWeeklyLossKg: planned,
    maxSafeWeeklyLossKg: MAX_SAFE,
  });
}

describe('assessProgress — objectif de perte', () => {
  it('ne conclut rien sans rythme observé', () => {
    expect(assess(undefined)).toBe('insufficient_data');
  });

  it('reconnaît un rythme conforme au plan', () => {
    expect(assess(observed(-0.6))).toBe('on_track');
  });

  it('reste « sur le rythme » à la borne basse de la tolérance', () => {
    expect(assess(observed(-PLANNED * ON_TRACK_RATE_FRACTION))).toBe('on_track');
  });

  it('signale un rythme plus lent que prévu', () => {
    expect(assess(observed(-0.3))).toBe('slower_than_planned');
  });

  it('fait passer la sécurité avant la conformité au plan', () => {
    // Perdre vite n'est pas une bonne nouvelle : c'est le seul statut qui prime
    // sur tous les autres.
    expect(assess(observed(-1.2))).toBe('faster_than_safe');
  });

  it('ne déclenche pas le drapeau de sécurité pile au plafond', () => {
    expect(assess(observed(-MAX_SAFE))).toBe('on_track');
  });

  it('signale une reprise au-delà de la bande de stabilité', () => {
    expect(assess(observed(STABLE_BAND_WEEKLY_KG + 0.05))).toBe('gaining');
  });

  it('lit une remontée dans le bruit de mesure comme un plateau, pas comme une reprise', () => {
    // Pile à la limite de la bande : la courbe ne descend plus, mais rien ne
    // permet d’affirmer qu’elle remonte. Le message de plateau est le bon —
    // celui de reprise inquiéterait pour une variation d’eau.
    expect(assess(observed(STABLE_BAND_WEEKLY_KG))).toBe('plateau');
  });
});

describe('assessProgress — détection de plateau', () => {
  it('déclare un plateau quand la courbe ne descend plus depuis assez longtemps', () => {
    expect(assess(observed(-0.05))).toBe('plateau');
  });

  it('attend trois semaines avant de parler de plateau', () => {
    // Même stagnation, mais sur deux semaines : une phase lutéale ou un
    // week-end salé suffisent à l'expliquer.
    expect(assess(observed(-0.05, { spanDays: PLATEAU_MIN_SPAN_DAYS - 1 }))).toBe(
      'slower_than_planned',
    );
  });

  it('exige assez de pesées pour que la pente soit soutenue', () => {
    expect(assess(observed(-0.05, { entryCount: PLATEAU_MIN_ENTRIES - 1 }))).toBe(
      'slower_than_planned',
    );
  });

  it('ne parle pas de plateau tant que la courbe descend encore un peu', () => {
    const justAboveBand = -PLANNED * PLATEAU_RATE_FRACTION;

    expect(assess(observed(justAboveBand))).toBe('slower_than_planned');
  });

  it('distingue un plateau d’une reprise', () => {
    expect(assess(observed(0.4))).toBe('gaining');
  });

  it('isPlateau ne reconnaît que le plateau', () => {
    expect(isPlateau('plateau')).toBe(true);
    expect(isPlateau('slower_than_planned')).toBe(false);
    expect(isPlateau('insufficient_data')).toBe(false);
  });
});

describe('assessProgress — objectif de maintien', () => {
  it('considère la stabilité comme une réussite', () => {
    expect(assess(observed(0), 0)).toBe('on_track');
    expect(assess(observed(-STABLE_BAND_WEEKLY_KG), 0)).toBe('on_track');
  });

  it('signale une perte non planifiée plutôt que de la saluer', () => {
    expect(assess(observed(-0.5), 0)).toBe('unplanned_loss');
  });

  it('signale une prise de poids', () => {
    expect(assess(observed(0.5), 0)).toBe('gaining');
  });

  it('ne déclenche jamais de plateau : la stabilité est l’objectif', () => {
    expect(assess(observed(0), 0)).not.toBe('plateau');
  });

  it('applique quand même le plafond de sécurité', () => {
    expect(assess(observed(-1.5), 0)).toBe('faster_than_safe');
  });
});
