import { InvalidBiometricsError, InvalidInputError } from '@/domain/errors';
import { calculateCalorieTarget } from '@/domain/nutrition/energy';
import {
  calculateMacros,
  FAT_ENERGY_SHARE,
  KCAL_PER_G_CARBS,
  KCAL_PER_G_FAT,
  KCAL_PER_G_PROTEIN,
  macroEnergyKcal,
  MIN_FAT_G_PER_KG,
  MIN_PROTEIN_G_PER_KG,
  PROTEIN_G_PER_KG,
} from '@/domain/nutrition/macros';
import type { GoalType } from '@/domain/profile/types';

import { buildProfile, NOW } from '../profile-fixtures';

/** Tolérance liée à l'arrondi des grammes (au plus ~7 kcal). */
const ROUNDING_TOLERANCE_KCAL = 10;

describe('constantes de répartition', () => {
  it('conserve les densités énergétiques et les cibles sourcées', () => {
    expect(KCAL_PER_G_PROTEIN).toBe(4);
    expect(KCAL_PER_G_CARBS).toBe(4);
    expect(KCAL_PER_G_FAT).toBe(9);
    expect(PROTEIN_G_PER_KG).toEqual({ weight_loss: 1.8, recomposition: 2.0, maintenance: 1.6 });
    expect(MIN_FAT_G_PER_KG).toBe(0.8);
    expect(MIN_PROTEIN_G_PER_KG).toBe(1.2);
    expect(FAT_ENERGY_SHARE).toBe(0.28);
  });

  it('garde toutes les cibles protéiques dans la fourchette 1.6–2.2 g/kg', () => {
    for (const value of Object.values(PROTEIN_G_PER_KG)) {
      expect(value).toBeGreaterThanOrEqual(1.6);
      expect(value).toBeLessThanOrEqual(2.2);
    }
  });
});

describe('calculateMacros — cas nominal', () => {
  const result = calculateMacros({ targetKcal: 2099, weightKg: 80, goalType: 'weight_loss' });

  it('vise 1.8 g/kg de protéines en perte de poids', () => {
    expect(result.proteinG).toBe(144);
    expect(result.proteinG / 80).toBeCloseTo(PROTEIN_G_PER_KG.weight_loss, 5);
  });

  it('place les lipides au-dessus du plancher santé', () => {
    expect(result.fatG).toBe(65);
    expect(result.fatG).toBeGreaterThanOrEqual(80 * MIN_FAT_G_PER_KG);
  });

  it('alloue le reste aux glucides', () => {
    expect(result.carbsG).toBe(235);
  });

  it('reconstitue l’objectif calorique à l’arrondi près', () => {
    expect(Math.abs(result.energyKcal - 2099)).toBeLessThanOrEqual(ROUNDING_TOLERANCE_KCAL);
  });

  it('ne déclenche aucun ajustement', () => {
    expect(result.adjustments).toEqual([]);
  });
});

describe('calculateMacros — par objectif', () => {
  it.each<[GoalType, number]>([
    ['weight_loss', 1.8],
    ['recomposition', 2.0],
    ['maintenance', 1.6],
  ])('applique %s g/kg pour l’objectif %s', (goalType, gPerKg) => {
    const weightKg = 75;
    const result = calculateMacros({ targetKcal: 2400, weightKg, goalType });

    expect(result.proteinG).toBe(Math.round(weightKg * gPerKg));
  });

  it('donne le plus de protéines en recomposition', () => {
    const input = { targetKcal: 2400, weightKg: 75 } as const;
    const recomposition = calculateMacros({ ...input, goalType: 'recomposition' });
    const weightLoss = calculateMacros({ ...input, goalType: 'weight_loss' });
    const maintenance = calculateMacros({ ...input, goalType: 'maintenance' });

    expect(recomposition.proteinG).toBeGreaterThan(weightLoss.proteinG);
    expect(weightLoss.proteinG).toBeGreaterThan(maintenance.proteinG);
  });
});

describe('calculateMacros — objectif calorique très bas', () => {
  it('réduit les protéines plutôt que le plancher lipidique', () => {
    const result = calculateMacros({ targetKcal: 1300, weightKg: 100, goalType: 'weight_loss' });

    expect(result.adjustments).toEqual(['protein_reduced']);
    expect(result.proteinG).toBe(145); // < 180 g visés
    expect(result.fatG).toBe(80); // plancher santé intact : 100 × 0.8
    expect(result.carbsG).toBe(0);
    expect(result.energyKcal).toBe(1300);
  });

  it('signale le cas extrême où les planchers ne tiennent pas dans l’objectif', () => {
    const result = calculateMacros({ targetKcal: 1200, weightKg: 150, goalType: 'weight_loss' });

    expect(result.adjustments).toEqual(['macro_floors_unreachable']);
    expect(result.proteinG).toBe(120);
    expect(result.fatG).toBe(80);
    expect(result.carbsG).toBe(0);
    expect(result.energyKcal).toBe(1200);
  });

  it('ne produit jamais de macro négatif', () => {
    for (const weightKg of [40, 60, 80, 100, 150, 250]) {
      for (const targetKcal of [1200, 1500, 1800, 2400, 3500]) {
        const result = calculateMacros({ targetKcal, weightKg, goalType: 'weight_loss' });

        expect(result.proteinG).toBeGreaterThanOrEqual(0);
        expect(result.fatG).toBeGreaterThanOrEqual(0);
        expect(result.carbsG).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('calculateMacros — entrées invalides', () => {
  it.each([0, -100, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejette un objectif calorique de %s',
    (targetKcal) => {
      expect(() => calculateMacros({ targetKcal, weightKg: 80, goalType: 'weight_loss' })).toThrow(
        InvalidInputError,
      );
    },
  );

  it('rejette un poids implausible', () => {
    expect(() =>
      calculateMacros({ targetKcal: 2000, weightKg: 0, goalType: 'weight_loss' }),
    ).toThrow(InvalidBiometricsError);
  });
});

describe('macroEnergyKcal', () => {
  it('applique les coefficients d’Atwater', () => {
    expect(macroEnergyKcal({ proteinG: 100, fatG: 50, carbsG: 200 })).toBe(400 + 450 + 800);
  });
});

describe('balayage : cohérence sur tout le domaine de calcul', () => {
  const goals: GoalType[] = ['weight_loss', 'recomposition', 'maintenance'];

  it('reste cohérent pour toute combinaison poids × objectif calorique', () => {
    for (const goalType of goals) {
      for (let weightKg = 30; weightKg <= 250; weightKg += 5) {
        for (let targetKcal = 1200; targetKcal <= 4500; targetKcal += 50) {
          const result = calculateMacros({ targetKcal, weightKg, goalType });

          // 1. Aucun macro négatif.
          expect(result.proteinG).toBeGreaterThanOrEqual(0);
          expect(result.fatG).toBeGreaterThanOrEqual(0);
          expect(result.carbsG).toBeGreaterThanOrEqual(0);

          // 2. Somme des macros = objectif calorique, à l'arrondi près.
          expect(Math.abs(result.energyKcal - targetKcal)).toBeLessThanOrEqual(
            ROUNDING_TOLERANCE_KCAL,
          );

          // 3. Le plancher lipidique n'est franchi que dans le cas extrême signalé.
          if (!result.adjustments.includes('macro_floors_unreachable')) {
            expect(result.fatG).toBeGreaterThanOrEqual(weightKg * MIN_FAT_G_PER_KG - 0.5);
          }

          // 4. Les protéines ne sont réduites que si c'est signalé.
          if (result.adjustments.length === 0) {
            expect(result.proteinG).toBe(Math.round(weightKg * PROTEIN_G_PER_KG[goalType]));
          }
        }
      }
    }
  });
});

describe('intégration avec l’objectif calorique', () => {
  it('produit une répartition cohérente à partir d’un profil réel', () => {
    const profile = buildProfile();
    const target = calculateCalorieTarget(profile, NOW);
    const macros = calculateMacros({
      targetKcal: target.targetKcal,
      weightKg: profile.currentWeightKg,
      goalType: profile.goalType,
    });

    expect(Math.abs(macros.energyKcal - target.targetKcal)).toBeLessThanOrEqual(
      ROUNDING_TOLERANCE_KCAL,
    );
    expect(macros.adjustments).toEqual([]);
  });

  it('reste cohérent même quand le plancher calorique a été appliqué', () => {
    const profile = buildProfile({
      sex: 'female',
      currentWeightKg: 50,
      heightCm: 155,
      birthDate: '1966-01-15',
      activityLevel: 'sedentary',
    });
    const target = calculateCalorieTarget(profile, NOW);
    const macros = calculateMacros({
      targetKcal: target.targetKcal,
      weightKg: profile.currentWeightKg,
      goalType: profile.goalType,
    });

    expect(target.adjustments).toContain('floor_applied');
    expect(macros.carbsG).toBeGreaterThanOrEqual(0);
    expect(macros.fatG).toBeGreaterThanOrEqual(profile.currentWeightKg * MIN_FAT_G_PER_KG - 0.5);
  });
});
