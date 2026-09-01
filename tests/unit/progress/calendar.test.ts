import { InvalidInputError } from '@/domain/errors';
import {
  addDays,
  compareIsoDates,
  daysBetween,
  parseIsoDate,
  toIsoDate,
} from '@/domain/progress/calendar';

describe('parseIsoDate', () => {
  it('interprète la date en UTC, sans dépendre du fuseau de l’appareil', () => {
    expect(parseIsoDate('2026-03-15').toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('tolère les espaces autour de la valeur', () => {
    expect(toIsoDate(parseIsoDate('  2026-03-15  '))).toBe('2026-03-15');
  });

  it('refuse un format inattendu', () => {
    expect(() => parseIsoDate('15/03/2026')).toThrow(InvalidInputError);
  });

  it('refuse une date qui n’existe pas au calendrier plutôt que de la décaler', () => {
    // `Date.UTC(2026, 1, 31)` donnerait le 3 mars sans broncher.
    expect(() => parseIsoDate('2026-02-31')).toThrow(/inexistante/);
  });

  it('accepte le 29 février d’une année bissextile', () => {
    expect(toIsoDate(parseIsoDate('2024-02-29'))).toBe('2024-02-29');
  });

  it('nomme le champ fautif pour que l’appelant sache lequel corriger', () => {
    expect(() => parseIsoDate('n’importe quoi', 'fromDate')).toThrow(
      expect.objectContaining({ field: 'fromDate' }),
    );
  });
});

describe('addDays', () => {
  it('avance d’un nombre de jours', () => {
    expect(addDays('2026-03-15', 10)).toBe('2026-03-25');
  });

  it('recule et traverse un changement de mois', () => {
    expect(addDays('2026-03-05', -10)).toBe('2026-02-23');
  });

  it('traverse un changement d’année', () => {
    expect(addDays('2026-01-02', -3)).toBe('2025-12-30');
  });

  it('gère le 29 février', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('refuse un décalage fractionnaire', () => {
    expect(() => addDays('2026-03-15', 1.5)).toThrow(InvalidInputError);
  });
});

describe('daysBetween', () => {
  it('compte les jours entre deux dates', () => {
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30);
  });

  it('est signé', () => {
    expect(daysBetween('2026-03-31', '2026-03-01')).toBe(-30);
  });

  it('vaut zéro pour la même date', () => {
    expect(daysBetween('2026-03-15', '2026-03-15')).toBe(0);
  });

  it('reste juste au passage à l’heure d’été', () => {
    // En Europe, le 29 mars 2026 fait 23 heures en heure locale. Un calcul en
    // heure locale renverrait 30 jours et demi arrondis à la louche.
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });
});

describe('compareIsoDates', () => {
  it('ordonne chronologiquement', () => {
    expect(['2026-03-15', '2026-01-02', '2026-02-28'].sort(compareIsoDates)).toEqual([
      '2026-01-02',
      '2026-02-28',
      '2026-03-15',
    ]);
  });

  it('renvoie zéro pour deux dates identiques', () => {
    expect(compareIsoDates('2026-03-15', '2026-03-15')).toBe(0);
  });
});
