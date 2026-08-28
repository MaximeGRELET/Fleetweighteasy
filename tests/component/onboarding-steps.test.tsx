import { fireEvent, within } from '@testing-library/react-native';

import ActivityScreen from '@/app/(onboarding)/activity';
import DietScreen from '@/app/(onboarding)/diet';
import RateScreen from '@/app/(onboarding)/rate';
import TargetWeightScreen from '@/app/(onboarding)/target-weight';
import TrainingScreen from '@/app/(onboarding)/training';
import WelcomeScreen from '@/app/(onboarding)/index';
import { calculateCalorieTarget, weeklyRateToDeficitKcal } from '@/domain/nutrition/energy';
import { getMaxWeeklyRateKg } from '@/domain/nutrition/safety';
import { minimumHealthyWeightKg } from '@/domain/profile/bmi';
import { buildUserProfile, type ProfileDraft } from '@/domain/profile/draft';
import { formatKcal, formatKg, formatWeeklyRate } from '@/lib/format';
import { useOnboardingStore } from '@/stores/onboarding';

import { asRenderedText, createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock } from '../support/router-mock';

describe('écran d’accueil', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('mène au consentement, pas à une saisie', async () => {
    const screen = await harness.renderScreen(<WelcomeScreen />);

    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(routerMock.push).toHaveBeenCalledWith('/(onboarding)/consent');
  });

  it('n’affiche pas de retour quand il n’y a nulle part où revenir', async () => {
    routerMock.canGoBack.mockReturnValue(false);
    const screen = await harness.renderScreen(<WelcomeScreen />);

    expect(screen.queryByTestId('step-back')).toBeNull();
  });

  it('affiche le disclaimer santé dès le premier écran', async () => {
    const screen = await harness.renderScreen(<WelcomeScreen />);

    expect(screen.getByText(/ne pose aucun diagnostic/)).toBeTruthy();
  });
});

describe('écran de poids cible', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.setDraft({ goalType: 'weight_loss', heightCm: 170, currentWeightKg: 80 });
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('offre un retour arrière visible, sans dépendre du geste système', async () => {
    const screen = await harness.renderScreen(<TargetWeightScreen />);

    await fireEvent.press(screen.getByTestId('step-back'));

    expect(routerMock.back).toHaveBeenCalled();
  });

  it('permet de ne pas fixer de poids cible', async () => {
    const screen = await harness.renderScreen(<TargetWeightScreen />);

    await fireEvent.press(screen.getByTestId('step-secondary'));

    expect(useOnboardingStore.getState().draft.targetWeightKg).toBeUndefined();
    expect(routerMock.push).toHaveBeenCalledWith('/(onboarding)/activity');
  });

  it('enregistre un poids cible sain sans rien signaler', async () => {
    const screen = await harness.renderScreen(<TargetWeightScreen />);

    await fireEvent.changeText(screen.getByTestId('target-weight-field'), '68');

    expect(screen.queryByTestId('underweight-warning')).toBeNull();

    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(useOnboardingStore.getState().draft.targetWeightKg).toBe(68);
  });

  it('avertit en direct quand le poids cible mène à une corpulence trop basse', async () => {
    const screen = await harness.renderScreen(<TargetWeightScreen />);

    // IMC 17 pour 1,70 m : sous le seuil de 18,5.
    await fireEvent.changeText(screen.getByTestId('target-weight-field'), '49');

    expect(screen.getByTestId('underweight-warning')).toBeTruthy();
    expect(screen.getByText(/médecin ou à un diététicien/)).toBeTruthy();
  });

  it('propose le bas de la fourchette saine plutôt que d’imposer une valeur', async () => {
    const screen = await harness.renderScreen(<TargetWeightScreen />);

    await fireEvent.changeText(screen.getByTestId('target-weight-field'), '49');

    // 18,5 × 1,70² = 53,5 kg
    expect(minimumHealthyWeightKg(170)).toBe(53.5);
    expect(screen.getByText(asRenderedText(formatKg(minimumHealthyWeightKg(170))))).toBeTruthy();
  });

  it('avertit mais ne bloque pas : c’est un signalement, pas un refus', async () => {
    const screen = await harness.renderScreen(<TargetWeightScreen />);

    await fireEvent.changeText(screen.getByTestId('target-weight-field'), '49');
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(routerMock.push).toHaveBeenCalledWith('/(onboarding)/activity');
    expect(useOnboardingStore.getState().draft.targetWeightKg).toBe(49);
  });

  it('refuse en revanche un poids hors plage physiologique', async () => {
    const screen = await harness.renderScreen(<TargetWeightScreen />);

    await fireEvent.changeText(screen.getByTestId('target-weight-field'), '8');
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.getByText(/entre 25 et 400 kg/)).toBeTruthy();
  });
});

describe('écran de rythme', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.setDraft({ goalType: 'weight_loss', currentWeightKg: 80 });
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('renvoie à la biométrie sans poids : le rythme en dépend', async () => {
    const bare = createAppHarness();
    bare.setDraft({ goalType: 'weight_loss' });
    const screen = await bare.renderScreen(<RateScreen />);

    expect(screen.getByTestId('redirect').props.children).toBe('/(onboarding)/biometrics');
    bare.cleanup();
  });

  it('borne le curseur au plafond calculé par le domaine', async () => {
    const screen = await harness.renderScreen(<RateScreen />);
    const slider = screen.getByTestId('rate-slider');

    // 1 % de 80 kg = 0,8 kg/semaine
    expect(slider.props.maximumValue).toBe(getMaxWeeklyRateKg(80));
    expect(slider.props.minimumValue).toBeGreaterThan(0);
    expect(slider.props.minimumValue).toBeLessThan(slider.props.maximumValue);
  });

  it('démarre sur le rythme recommandé', async () => {
    const screen = await harness.renderScreen(<RateScreen />);

    // 0,75 % de 80 kg = 0,6 kg/semaine
    expect(screen.getByTestId('rate-slider').props.value).toBe(0.6);
    expect(screen.getByText(/le rythme recommandé/)).toBeTruthy();
  });

  it('explique pourquoi le curseur s’arrête là', async () => {
    const screen = await harness.renderScreen(<RateScreen />);

    expect(screen.getByTestId('rate-cap-explanation')).toBeTruthy();
    expect(screen.getByText(/perte de masse musculaire/)).toBeTruthy();
  });

  it('enregistre le rythme choisi', async () => {
    const screen = await harness.renderScreen(<RateScreen />);

    await fireEvent(screen.getByTestId('rate-slider'), 'valueChange', 0.4);
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(useOnboardingStore.getState().draft.weeklyRateKg).toBe(0.4);
    expect(routerMock.push).toHaveBeenCalledWith('/(onboarding)/summary');
  });
});

/**
 * Le déficit quotidien est écrêté à 750 kcal, indépendamment du plafond de
 * rythme. Selon le poids, la moitié haute du curseur pointe donc un rythme que
 * le corps n'atteindra pas — et cela ne doit jamais rester silencieux.
 */
describe('écran de rythme — écrêtage du déficit', () => {
  let harness: AppHarness;

  /** Profil complet : sans lui, l'écran ne peut pas projeter le résultat réel. */
  const PROFILE: Partial<ProfileDraft> = {
    goalType: 'weight_loss',
    sex: 'male',
    birthDate: '1996-01-15',
    heightCm: 180,
    activityLevel: 'moderately_active',
    trainingDaysPerWeek: 3,
    dietType: 'omnivore',
  };

  function projectionFor(currentWeightKg: number, weeklyRateKg: number) {
    return calculateCalorieTarget(
      buildUserProfile({
        allergies: [],
        dislikes: [],
        calorieMode: 'fixed',
        ...PROFILE,
        currentWeightKg,
        weeklyRateKg,
      } as ProfileDraft),
    );
  }

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  describe('au-dessus du seuil d’écrêtage', () => {
    // 90 kg : le curseur monte à 0,9 kg/semaine, soit 990 kcal de déficit
    // théorique — bien au-delà du plafond de 750.
    const WEIGHT_KG = 90;
    const REQUESTED_RATE_KG = 0.9;

    async function renderAtMaxRate() {
      harness.setDraft({ ...PROFILE, currentWeightKg: WEIGHT_KG });
      const screen = await harness.renderScreen(<RateScreen />);
      await fireEvent(screen.getByTestId('rate-slider'), 'valueChange', REQUESTED_RATE_KG);
      return screen;
    }

    it('est bien un cas d’écrêtage', () => {
      const projection = projectionFor(WEIGHT_KG, REQUESTED_RATE_KG);

      expect(projection.adjustments).toContain('deficit_capped');
      expect(projection.effectiveWeeklyRateKg).toBeLessThan(REQUESTED_RATE_KG);
    });

    it('affiche le message d’explication', async () => {
      const screen = await renderAtMaxRate();

      expect(screen.getByTestId('explanation-rate_clipped')).toBeTruthy();
    });

    it('donne le déficit théorique, la limite appliquée et la perte réelle', async () => {
      const screen = await renderAtMaxRate();
      const projection = projectionFor(WEIGHT_KG, REQUESTED_RATE_KG);

      const message = within(screen.getByTestId('explanation-rate_clipped'));

      expect(
        message.getByText(asRenderedText(formatKcal(weeklyRateToDeficitKcal(REQUESTED_RATE_KG)))),
      ).toBeTruthy();
      expect(
        message.getByText(asRenderedText(formatKcal(projection.appliedDeficitKcal))),
      ).toBeTruthy();
      expect(
        message.getByText(asRenderedText(formatWeeklyRate(projection.effectiveWeeklyRateKg))),
      ).toBeTruthy();
    });

    it('affiche la perte réellement atteignable, distincte du rythme pointé', async () => {
      const screen = await renderAtMaxRate();
      const projection = projectionFor(WEIGHT_KG, REQUESTED_RATE_KG);

      const requested = screen.getByTestId('rate-requested').props.children;
      const effective = formatWeeklyRate(projection.effectiveWeeklyRateKg);

      expect(requested).toBe(formatWeeklyRate(REQUESTED_RATE_KG));
      expect(effective).not.toBe(requested);
      expect(screen.getByTestId('rate-effective').props.children).toBe(effective);
    });
  });

  describe('en dessous du seuil d’écrêtage', () => {
    it('n’affiche aucun message : le rythme demandé sera tenu', async () => {
      harness.setDraft({ ...PROFILE, currentWeightKg: 90 });
      const screen = await harness.renderScreen(<RateScreen />);

      await fireEvent(screen.getByTestId('rate-slider'), 'valueChange', 0.5);

      expect(screen.queryByTestId('explanation-rate_clipped')).toBeNull();
      expect(projectionFor(90, 0.5).adjustments).toEqual([]);
    });

    it('affiche alors une perte atteignable égale au rythme pointé', async () => {
      harness.setDraft({ ...PROFILE, currentWeightKg: 90 });
      const screen = await harness.renderScreen(<RateScreen />);

      await fireEvent(screen.getByTestId('rate-slider'), 'valueChange', 0.5);

      // Rien n'étant écrêté, le rythme pointé et la perte atteignable coïncident.
      expect(screen.getByTestId('rate-requested').props.children).toBe(formatWeeklyRate(0.5));
      expect(screen.getByTestId('rate-effective').props.children).toBe(formatWeeklyRate(0.5));
    });

    it('ne se déclenche jamais pour un poids dont le plafond reste sous le seuil', async () => {
      // 55 kg : au maximum du curseur (0,55 kg/sem), le déficit reste sous 750.
      harness.setDraft({ ...PROFILE, currentWeightKg: 55 });
      const screen = await harness.renderScreen(<RateScreen />);

      await fireEvent(screen.getByTestId('rate-slider'), 'valueChange', 0.55);

      expect(screen.queryByTestId('explanation-rate_clipped')).toBeNull();
      expect(projectionFor(55, 0.55).adjustments).toEqual([]);
    });
  });

  it('n’écrête rien lui-même : la projection vient du domaine', async () => {
    harness.setDraft({ ...PROFILE, currentWeightKg: 90 });
    const screen = await harness.renderScreen(<RateScreen />);

    await fireEvent(screen.getByTestId('rate-slider'), 'valueChange', 0.9);
    const projection = projectionFor(90, 0.9);

    // L'objectif affiché est celui que renverra le domaine au moment de le
    // persister : aucune valeur intermédiaire recalculée ici.
    expect(
      screen.getAllByText(asRenderedText(formatKcal(projection.targetKcal))).length,
    ).toBeGreaterThan(0);
  });
});

describe('écran d’activité', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.setDraft({ goalType: 'weight_loss' });
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('bloque tant qu’aucun niveau n’est choisi', async () => {
    const screen = await harness.renderScreen(<ActivityScreen />);

    expect(screen.getByTestId('step-primary').props.accessibilityState.disabled).toBe(true);
  });

  it('décrit chaque niveau concrètement plutôt que par une étiquette', async () => {
    const screen = await harness.renderScreen(<ActivityScreen />);

    expect(screen.getByText(/Travail assis/)).toBeTruthy();
    expect(screen.getByText(/3 à 5 séances par semaine/)).toBeTruthy();
  });

  it('enregistre le niveau et avance', async () => {
    const screen = await harness.renderScreen(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId('activity-moderately_active'));
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(useOnboardingStore.getState().draft.activityLevel).toBe('moderately_active');
    expect(routerMock.push).toHaveBeenCalledWith('/(onboarding)/training');
  });

  it('rappelle que le sport habituel est déjà compté', async () => {
    const screen = await harness.renderScreen(<ActivityScreen />);

    expect(screen.getByText(/n’augmentent pas ton budget calorique/)).toBeTruthy();
  });
});

describe('écran d’entraînement', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.setDraft({ goalType: 'weight_loss' });
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('bloque tant que le nombre de jours n’est pas renseigné', async () => {
    const screen = await harness.renderScreen(<TrainingScreen />);

    expect(screen.getByTestId('step-primary').props.accessibilityState.disabled).toBe(true);
  });

  it('accepte zéro jour d’entraînement', async () => {
    const screen = await harness.renderScreen(<TrainingScreen />);

    await fireEvent.press(screen.getByTestId('training-days-0'));

    expect(screen.getByTestId('step-primary').props.accessibilityState.disabled).toBe(false);
    expect(useOnboardingStore.getState().draft.trainingDaysPerWeek).toBe(0);
  });

  it('ne demande le lieu qu’à ceux qui font de la musculation', async () => {
    const screen = await harness.renderScreen(<TrainingScreen />);

    expect(screen.queryByTestId('environment-gym')).toBeNull();

    await fireEvent.press(screen.getByTestId('practice-strength'));

    expect(screen.getByTestId('environment-gym')).toBeTruthy();
    expect(screen.queryByTestId('cardio-running')).toBeNull();
  });

  it('ne demande le type de cardio qu’à ceux qui en font', async () => {
    const screen = await harness.renderScreen(<TrainingScreen />);

    await fireEvent.press(screen.getByTestId('practice-cardio'));
    await fireEvent.press(screen.getByTestId('cardio-running'));

    expect(useOnboardingStore.getState().draft.sportProfile).toEqual({
      practices: ['cardio'],
      strengthEnvironments: [],
      cardioActivities: ['running'],
    });
  });

  it('permet de désélectionner une pratique', async () => {
    const screen = await harness.renderScreen(<TrainingScreen />);

    await fireEvent.press(screen.getByTestId('practice-cardio'));
    await fireEvent.press(screen.getByTestId('practice-cardio'));

    expect(useOnboardingStore.getState().draft.sportProfile?.practices).toEqual([]);
  });
});

describe('écran d’alimentation', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.setDraft({ goalType: 'weight_loss' });
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('bloque tant qu’aucun régime n’est choisi', async () => {
    const screen = await harness.renderScreen(<DietScreen />);

    expect(screen.getByTestId('step-primary').props.accessibilityState.disabled).toBe(true);
  });

  it('enregistre régime, allergies et aliments détestés', async () => {
    const screen = await harness.renderScreen(<DietScreen />);

    await fireEvent.press(screen.getByTestId('diet-vegetarian'));
    await fireEvent.press(screen.getByTestId('allergy-Gluten'));
    await fireEvent.press(screen.getByTestId('dislike-Coriandre'));

    const draft = useOnboardingStore.getState().draft;
    expect(draft.dietType).toBe('vegetarian');
    expect(draft.allergies).toEqual(['Gluten']);
    expect(draft.dislikes).toEqual(['Coriandre']);
  });

  it('accepte une allergie hors liste', async () => {
    const screen = await harness.renderScreen(<DietScreen />);

    await fireEvent.changeText(screen.getByTestId('custom-allergy-field'), 'Sésame');
    await fireEvent.press(screen.getByTestId('add-allergy'));

    expect(useOnboardingStore.getState().draft.allergies).toEqual(['Sésame']);
    expect(screen.getByTestId('allergy-Sésame')).toBeTruthy();
  });

  it('ignore un ajout vide ou en doublon', async () => {
    const screen = await harness.renderScreen(<DietScreen />);

    await fireEvent.changeText(screen.getByTestId('custom-dislike-field'), '   ');
    await fireEvent.press(screen.getByTestId('add-dislike'));

    expect(useOnboardingStore.getState().draft.dislikes).toEqual([]);

    await fireEvent.changeText(screen.getByTestId('custom-dislike-field'), 'Olives');
    await fireEvent.press(screen.getByTestId('add-dislike'));
    await fireEvent.changeText(screen.getByTestId('custom-dislike-field'), 'olives');
    await fireEvent.press(screen.getByTestId('add-dislike'));

    expect(useOnboardingStore.getState().draft.dislikes).toEqual(['Olives']);
  });

  it('avance une fois le régime choisi', async () => {
    const screen = await harness.renderScreen(<DietScreen />);

    await fireEvent.press(screen.getByTestId('diet-omnivore'));
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(routerMock.push).toHaveBeenCalledWith('/(onboarding)/rate');
  });
});
