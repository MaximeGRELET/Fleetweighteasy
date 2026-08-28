import { getMaxWeeklyRateKg } from '@/domain/nutrition/safety';
import {
  MAX_PLAUSIBLE_HEIGHT_CM,
  MAX_PLAUSIBLE_WEIGHT_KG,
  MIN_PLAUSIBLE_HEIGHT_CM,
  MIN_PLAUSIBLE_WEIGHT_KG,
} from '@/domain/profile/bmi';
import {
  buildBiometricsStepSchema,
  buildBirthDateSchema,
  buildWeeklyRateStepSchema,
  dietStepSchema,
  goalStepSchema,
  heightCmSchema,
  targetWeightStepSchema,
  trainingStepSchema,
  weightKgSchema,
} from '@/domain/profile/validation';

const NOW = new Date('2026-03-15T00:00:00Z');

/**
 * Ces schémas sont la garantie que l'UI ne réécrit aucune règle métier : ils
 * doivent refuser exactement ce que refusent les bornes du domaine.
 */
describe('bornes biométriques', () => {
  it('accepte les valeurs aux bornes du domaine', () => {
    expect(heightCmSchema.safeParse(MIN_PLAUSIBLE_HEIGHT_CM).success).toBe(true);
    expect(heightCmSchema.safeParse(MAX_PLAUSIBLE_HEIGHT_CM).success).toBe(true);
    expect(weightKgSchema.safeParse(MIN_PLAUSIBLE_WEIGHT_KG).success).toBe(true);
    expect(weightKgSchema.safeParse(MAX_PLAUSIBLE_WEIGHT_KG).success).toBe(true);
  });

  it('refuse juste au-delà des bornes du domaine', () => {
    expect(heightCmSchema.safeParse(MIN_PLAUSIBLE_HEIGHT_CM - 1).success).toBe(false);
    expect(heightCmSchema.safeParse(MAX_PLAUSIBLE_HEIGHT_CM + 1).success).toBe(false);
    expect(weightKgSchema.safeParse(MIN_PLAUSIBLE_WEIGHT_KG - 1).success).toBe(false);
    expect(weightKgSchema.safeParse(MAX_PLAUSIBLE_WEIGHT_KG + 1).success).toBe(false);
  });

  it('refuse ce qui n’est pas un nombre', () => {
    expect(weightKgSchema.safeParse(undefined).success).toBe(false);
    expect(weightKgSchema.safeParse(Number.NaN).success).toBe(false);
  });
});

describe('date de naissance', () => {
  const schema = buildBirthDateSchema(NOW);

  it('accepte une date plausible', () => {
    expect(schema.safeParse('1992-06-10').success).toBe(true);
  });

  it.each(['10/06/1992', '', 'hier', '1992-02-30'])('refuse « %s »', (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it('refuse une date dans le futur', () => {
    expect(schema.safeParse('2030-01-01').success).toBe(false);
  });

  it('refuse un âge sous le minimum, avec un message compréhensible', () => {
    const result = schema.safeParse('2020-01-01');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/13 ans/);
  });

  it('refuse un âge invraisemblable', () => {
    expect(schema.safeParse('1850-01-01').success).toBe(false);
  });

  it('se réfère à l’instant courant par défaut', () => {
    // Sans instant injecté, une date très ancienne reste invraisemblable.
    expect(buildBirthDateSchema().safeParse('1850-01-01').success).toBe(false);
    expect(
      buildBiometricsStepSchema().safeParse({
        sex: 'male',
        birthDate: '1990-01-01',
        heightCm: 180,
        currentWeightKg: 80,
      }).success,
    ).toBe(true);
  });
});

describe('étape biométrie', () => {
  const schema = buildBiometricsStepSchema(NOW);

  it('valide une saisie complète', () => {
    expect(
      schema.safeParse({
        sex: 'female',
        birthDate: '1992-06-10',
        heightCm: 168,
        currentWeightKg: 72.5,
      }).success,
    ).toBe(true);
  });

  it('refuse une saisie incomplète', () => {
    expect(schema.safeParse({ sex: 'female', birthDate: '1992-06-10' }).success).toBe(false);
  });

  it('refuse un sexe hors des deux valeurs métaboliques', () => {
    expect(
      schema.safeParse({
        sex: 'autre',
        birthDate: '1992-06-10',
        heightCm: 168,
        currentWeightKg: 72.5,
      }).success,
    ).toBe(false);
  });
});

describe('étape poids cible', () => {
  it('accepte l’absence de poids cible', () => {
    expect(targetWeightStepSchema.safeParse({}).success).toBe(true);
    expect(targetWeightStepSchema.safeParse({ targetWeightKg: undefined }).success).toBe(true);
  });

  it('n’interdit pas un poids cible menant à l’insuffisance pondérale', () => {
    // Le domaine lèvera `goal_leads_to_underweight` ; l'UI avertit sans bloquer.
    expect(targetWeightStepSchema.safeParse({ targetWeightKg: 42 }).success).toBe(true);
  });

  it('refuse un poids hors plage physiologique', () => {
    expect(targetWeightStepSchema.safeParse({ targetWeightKg: 5 }).success).toBe(false);
  });
});

describe('étape rythme', () => {
  it('plafonne au rythme maximal calculé par le domaine', () => {
    const currentWeightKg = 80;
    const schema = buildWeeklyRateStepSchema(currentWeightKg);
    const maxWeeklyRateKg = getMaxWeeklyRateKg(currentWeightKg);

    expect(schema.safeParse({ weeklyRateKg: maxWeeklyRateKg }).success).toBe(true);
    expect(schema.safeParse({ weeklyRateKg: maxWeeklyRateKg + 0.01 }).success).toBe(false);
  });

  it('suit le poids : un poids plus faible abaisse le plafond', () => {
    expect(buildWeeklyRateStepSchema(50).safeParse({ weeklyRateKg: 0.7 }).success).toBe(false);
    expect(buildWeeklyRateStepSchema(90).safeParse({ weeklyRateKg: 0.7 }).success).toBe(true);
  });

  it('refuse un rythme nul ou négatif', () => {
    const schema = buildWeeklyRateStepSchema(80);

    expect(schema.safeParse({ weeklyRateKg: 0 }).success).toBe(false);
    expect(schema.safeParse({ weeklyRateKg: -0.5 }).success).toBe(false);
  });

  it('explique le plafond dans le message', () => {
    const result = buildWeeklyRateStepSchema(80).safeParse({ weeklyRateKg: 2 });

    expect(result.error?.issues[0]?.message).toMatch(/0.80 kg par semaine/);
  });
});

describe('autres étapes', () => {
  it('valide l’objectif', () => {
    expect(goalStepSchema.safeParse({ goalType: 'weight_loss' }).success).toBe(true);
    expect(goalStepSchema.safeParse({ goalType: 'seche' }).success).toBe(false);
  });

  it('valide les jours d’entraînement et le profil sportif', () => {
    const sportProfile = { practices: [], strengthEnvironments: [], cardioActivities: [] };

    expect(trainingStepSchema.safeParse({ trainingDaysPerWeek: 0, sportProfile }).success).toBe(
      true,
    );
    expect(trainingStepSchema.safeParse({ trainingDaysPerWeek: 7, sportProfile }).success).toBe(
      true,
    );
    expect(trainingStepSchema.safeParse({ trainingDaysPerWeek: 8, sportProfile }).success).toBe(
      false,
    );
    expect(trainingStepSchema.safeParse({ trainingDaysPerWeek: 2.5, sportProfile }).success).toBe(
      false,
    );
  });

  it('valide l’alimentation, listes vides comprises', () => {
    expect(
      dietStepSchema.safeParse({ dietType: 'vegan', allergies: [], dislikes: [] }).success,
    ).toBe(true);
    expect(
      dietStepSchema.safeParse({ dietType: 'carnivore', allergies: [], dislikes: [] }).success,
    ).toBe(false);
  });
});
