import { InvalidBiometricsError } from '@/domain/errors';
import { getAge } from '@/domain/profile/age';

describe('getAge', () => {
  const now = new Date('2026-08-27T12:00:00Z');

  it('compte les années révolues quand l’anniversaire est passé', () => {
    expect(getAge('1994-03-15', now)).toBe(32);
  });

  it('ne compte pas l’année en cours avant l’anniversaire', () => {
    expect(getAge('1994-09-15', now)).toBe(31);
  });

  it('compte l’année le jour même de l’anniversaire', () => {
    expect(getAge('1994-08-27', now)).toBe(32);
  });

  it('ne compte pas l’année la veille de l’anniversaire', () => {
    expect(getAge('1994-08-28', now)).toBe(31);
  });

  it('gère un anniversaire plus tôt dans le même mois', () => {
    expect(getAge('1994-08-01', now)).toBe(32);
  });

  it('gère le 29 février', () => {
    expect(getAge('2000-02-29', new Date('2026-02-28T00:00:00Z'))).toBe(25);
    expect(getAge('2000-02-29', new Date('2026-03-01T00:00:00Z'))).toBe(26);
  });

  it('accepte les espaces autour de la date', () => {
    expect(getAge('  1994-03-15  ', now)).toBe(32);
  });

  it('utilise l’instant courant par défaut', () => {
    const thisYear = new Date().getUTCFullYear();
    expect(getAge(`${thisYear - 40}-01-01`)).toBeGreaterThanOrEqual(39);
  });

  it.each(['15/03/1994', '1994-3-15', '', 'hier', '1994-02-30'])(
    'rejette la date invalide « %s »',
    (value) => {
      expect(() => getAge(value, now)).toThrow(InvalidBiometricsError);
    },
  );

  it('rejette une date de naissance dans le futur', () => {
    expect(() => getAge('2030-01-01', now)).toThrow(/futur/);
  });

  it('rejette un instant de référence invalide', () => {
    expect(() => getAge('1994-03-15', new Date('pas une date'))).toThrow(InvalidBiometricsError);
  });

  it('expose un code d’erreur stable pour la couche UI', () => {
    expect.assertions(2);
    try {
      getAge('nope', now);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidBiometricsError);
      expect((error as InvalidBiometricsError).code).toBe('invalid_biometrics');
    }
  });
});
