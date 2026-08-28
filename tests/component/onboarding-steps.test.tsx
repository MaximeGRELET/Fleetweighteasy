import { fireEvent } from '@testing-library/react-native';

import ActivityScreen from '@/app/(onboarding)/activity';
import DietScreen from '@/app/(onboarding)/diet';
import RateScreen from '@/app/(onboarding)/rate';
import TargetWeightScreen from '@/app/(onboarding)/target-weight';
import TrainingScreen from '@/app/(onboarding)/training';
import WelcomeScreen from '@/app/(onboarding)/index';
import { getMaxWeeklyRateKg } from '@/domain/nutrition/safety';
import { minimumHealthyWeightKg } from '@/domain/profile/bmi';
import { formatKg } from '@/lib/format';
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
