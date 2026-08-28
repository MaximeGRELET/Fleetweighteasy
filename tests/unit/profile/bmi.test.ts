import { InvalidBiometricsError } from '@/domain/errors';
import {
  assertPlausibleAge,
  assertPlausibleHeight,
  assertPlausibleWeight,
  BMI_UNDERWEIGHT_THRESHOLD,
  calculateBmi,
  classifyBmi,
  minimumHealthyWeightKg,
} from '@/domain/profile/bmi';

describe('calculateBmi', () => {
  it('applique poids / taille²', () => {
    // 70 / 1.75² = 22.857… → 22.9
    expect(calculateBmi({ weightKg: 70, heightCm: 175 })).toBe(22.9);
  });

  it('arrondit au dixième', () => {
    expect(calculateBmi({ weightKg: 49, heightCm: 170 })).toBe(17);
  });

  it('rejette les biométries hors plage', () => {
    expect(() => calculateBmi({ weightKg: -70, heightCm: 175 })).toThrow(InvalidBiometricsError);
    expect(() => calculateBmi({ weightKg: 70, heightCm: 0 })).toThrow(InvalidBiometricsError);
  });
});

describe('classifyBmi', () => {
  it.each([
    [17, 'underweight'],
    [18.4, 'underweight'],
    [18.5, 'normal'],
    [24.9, 'normal'],
    [25, 'overweight'],
    [29.9, 'overweight'],
    [30, 'obesity'],
    [42, 'obesity'],
  ])('classe un IMC de %s comme %s', (bmi, expected) => {
    expect(classifyBmi(bmi)).toBe(expected);
  });

  it('place la frontière d’insuffisance pondérale sur le seuil documenté', () => {
    expect(BMI_UNDERWEIGHT_THRESHOLD).toBe(18.5);
    expect(classifyBmi(BMI_UNDERWEIGHT_THRESHOLD)).toBe('normal');
  });
});

describe('minimumHealthyWeightKg', () => {
  it('renvoie le poids correspondant à l’IMC plancher', () => {
    // 18.5 × 1.70² = 53.465 → 53.5
    expect(minimumHealthyWeightKg(170)).toBe(53.5);
  });

  it('produit un poids classé « normal »', () => {
    const heightCm = 162;
    const weightKg = minimumHealthyWeightKg(heightCm);
    expect(classifyBmi(calculateBmi({ weightKg, heightCm }))).toBe('normal');
  });

  it('rejette une taille implausible', () => {
    expect(() => minimumHealthyWeightKg(40)).toThrow(InvalidBiometricsError);
  });
});

describe('bornes de plausibilité', () => {
  it.each([24.9, 400.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejette le poids %s',
    (weightKg) => {
      expect(() => assertPlausibleWeight(weightKg)).toThrow(InvalidBiometricsError);
    },
  );

  it.each([99, 250.1, Number.NaN])('rejette la taille %s', (heightCm) => {
    expect(() => assertPlausibleHeight(heightCm)).toThrow(InvalidBiometricsError);
  });

  it.each([12, 121, Number.NaN])('rejette l’âge %s', (ageYears) => {
    expect(() => assertPlausibleAge(ageYears)).toThrow(InvalidBiometricsError);
  });

  it('accepte les valeurs aux bornes', () => {
    expect(() => assertPlausibleWeight(25)).not.toThrow();
    expect(() => assertPlausibleWeight(400)).not.toThrow();
    expect(() => assertPlausibleHeight(100)).not.toThrow();
    expect(() => assertPlausibleHeight(250)).not.toThrow();
    expect(() => assertPlausibleAge(13)).not.toThrow();
    expect(() => assertPlausibleAge(120)).not.toThrow();
  });

  it('nomme le champ fautif pour la couche UI', () => {
    expect.assertions(1);
    try {
      assertPlausibleHeight(10);
    } catch (error) {
      expect((error as InvalidBiometricsError).field).toBe('heightCm');
    }
  });
});
