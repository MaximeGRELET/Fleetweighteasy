import type { FoodItem } from '@/domain/food/types';
import type { UserProfile } from '@/domain/profile/types';

export function buildFoodItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'food-riz',
    source: 'off',
    barcode: '3017620422003',
    name: 'Riz basmati cuit',
    brand: 'Marque Test',
    nutritionPer100: {
      kcal: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
      fiberG: 0.4,
    },
    servingSizes: [{ label: '1 portion', grams: 150 }],
    verified: false,
    cachedAt: '2026-03-15T08:00:00.000Z',
    ...overrides,
  };
}

export function buildStoredProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    sex: 'female',
    birthDate: '1992-06-10',
    heightCm: 168,
    currentWeightKg: 72.5,
    goalType: 'weight_loss',
    targetWeightKg: 65,
    activityLevel: 'lightly_active',
    trainingDaysPerWeek: 3,
    dietType: 'omnivore',
    allergies: ['arachide'],
    dislikes: ['coriandre'],
    calorieMode: 'fixed',
    onboardingCompleted: true,
    ...overrides,
  };
}
