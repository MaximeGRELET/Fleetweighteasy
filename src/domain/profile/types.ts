/**
 * Modèle utilisateur — colonne vertébrale de l'application.
 *
 * Défini une seule fois ici et importé partout (PLAN_IMPLEMENTATION §3.3).
 * Aucune dépendance : ce fichier est du TypeScript pur.
 */

/**
 * Sexe biologique.
 *
 * Sert **exclusivement** au calcul métabolique : Mifflin-St Jeor et les
 * planchers caloriques cliniques sont établis sur le sexe biologique
 * (PHASE_1 §9). Ce champ modélise la biologie, distincte de l'identité de
 * genre — à formuler avec respect côté UI le moment venu.
 */
export type Sex = 'male' | 'female';

export type GoalType = 'weight_loss' | 'recomposition' | 'maintenance';

export type ActivityLevel =
  'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';

/** Mode de gestion des calories sport. Défaut produit : `fixed`. */
export type CalorieMode = 'fixed' | 'credited';

export type DietType = 'omnivore' | 'flexitarian' | 'pescatarian' | 'vegetarian' | 'vegan';

export interface UserProfile {
  // Biométrie
  sex: Sex;
  /** ISO 8601 (`YYYY-MM-DD`). L'âge est toujours dérivé, jamais stocké figé. */
  birthDate: string;
  heightCm: number;
  currentWeightKg: number;

  // Objectif
  goalType: GoalType;
  targetWeightKg?: number;
  /** Rythme visé en kg/semaine. Borné par les garde-fous (nutrition/safety.ts). */
  weeklyRateKg?: number;

  // Activité & sport
  activityLevel: ActivityLevel;
  trainingDaysPerWeek: number;

  // Alimentation (exploitée à partir de la Phase 7 ; présente ici pour cohérence)
  dietType: DietType;
  allergies: string[];
  dislikes: string[];

  // Réglages
  calorieMode: CalorieMode;

  // Métadonnées
  onboardingCompleted: boolean;
}

/** Valeur par défaut du mode calories, exposée pour l'onboarding. */
export const DEFAULT_CALORIE_MODE: CalorieMode = 'fixed';
