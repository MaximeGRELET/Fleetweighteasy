import { fireEvent } from '@testing-library/react-native';

import CalorieModeScreen from '@/app/(onboarding)/calorie-mode';
import GoalScreen from '@/app/(onboarding)/goal';
import RootScreen from '@/app/index';
import { buildCaloriePlan } from '@/hooks/use-profile';
import { formatKcal } from '@/lib/format';
import { useOnboardingStore } from '@/stores/onboarding';

import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock } from '../support/router-mock';

const READY_DRAFT = {
  goalType: 'weight_loss' as const,
  sex: 'male' as const,
  birthDate: '1996-01-15',
  heightCm: 180,
  currentWeightKg: 80,
  activityLevel: 'moderately_active' as const,
  trainingDaysPerWeek: 3,
  dietType: 'omnivore' as const,
};

describe('enchaînement des écrans', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('enregistre l’objectif choisi et passe à la biométrie', async () => {
    const screen = await harness.renderScreen(<GoalScreen />);

    await fireEvent.press(screen.getByTestId('goal-weight_loss'));
    await fireEvent.press(screen.getByTestId('step-primary'));

    // La biométrie précède le poids cible : le contrôle d'IMC a besoin de la taille.
    expect(routerMock.push).toHaveBeenCalledWith('/(onboarding)/biometrics');
    expect(useOnboardingStore.getState().draft.goalType).toBe('weight_loss');
  });

  it('adapte la progression affichée à l’objectif', async () => {
    const screen = await harness.renderScreen(<GoalScreen />);

    await fireEvent.press(screen.getByTestId('goal-maintenance'));

    // Le maintien traverse deux écrans de moins : pas de poids cible, pas de rythme.
    expect(screen.getByLabelText('Étape 1 sur 7')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('goal-weight_loss'));

    expect(screen.getByLabelText('Étape 1 sur 9')).toBeTruthy();
  });

  it('bloque tant qu’aucun objectif n’est choisi', async () => {
    const screen = await harness.renderScreen(<GoalScreen />);

    expect(screen.getByTestId('step-primary').props.accessibilityState.disabled).toBe(true);
  });
});

describe('dernier écran et persistance', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.setDraft(READY_DRAFT);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('propose le mode fixe comme recommandé, sans masquer l’autre', async () => {
    const screen = await harness.renderScreen(<CalorieModeScreen />);

    expect(screen.getByText('Recommandé')).toBeTruthy();
    expect(screen.getByTestId('calorie-mode-fixed')).toBeTruthy();
    expect(screen.getByTestId('calorie-mode-credited')).toBeTruthy();
    expect(screen.getByText(/s’ajoutent à ton budget/)).toBeTruthy();
  });

  it('part sur le mode fixe par défaut', async () => {
    const screen = await harness.renderScreen(<CalorieModeScreen />);

    expect(screen.getByTestId('calorie-mode-fixed').props.accessibilityState.selected).toBe(true);
  });

  it('persiste le profil et clôt l’onboarding', async () => {
    const screen = await harness.renderScreen(<CalorieModeScreen />);

    await fireEvent.press(screen.getByTestId('step-primary'));

    const stored = harness.repositories.profile.get();
    expect(stored).toMatchObject({ ...READY_DRAFT, calorieMode: 'fixed' });
    expect(stored?.onboardingCompleted).toBe(true);
    expect(harness.repositories.profile.hasCompletedOnboarding()).toBe(true);
  });

  it('enregistre le mode choisi', async () => {
    const screen = await harness.renderScreen(<CalorieModeScreen />);

    await fireEvent.press(screen.getByTestId('calorie-mode-credited'));
    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(harness.repositories.profile.get()?.calorieMode).toBe('credited');
  });

  it('efface le brouillon en mémoire une fois le profil persisté', async () => {
    const screen = await harness.renderScreen(<CalorieModeScreen />);

    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(useOnboardingStore.getState().draft.currentWeightKg).toBeUndefined();
  });

  it('remplace la pile de navigation au lieu de l’empiler', async () => {
    const screen = await harness.renderScreen(<CalorieModeScreen />);

    await fireEvent.press(screen.getByTestId('step-primary'));

    expect(routerMock.replace).toHaveBeenCalledWith('/');
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('ne persiste aucun objectif calculé', async () => {
    const screen = await harness.renderScreen(<CalorieModeScreen />);
    await fireEvent.press(screen.getByTestId('step-primary'));

    const columns = Object.keys(harness.repositories.profile.get() ?? {});

    expect(columns).not.toContain('targetKcal');
    expect(columns).not.toContain('tdeeKcal');
  });
});

describe('aiguillage racine', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('envoie vers l’onboarding quand aucun profil n’existe', async () => {
    const screen = await harness.renderScreen(<RootScreen />);

    expect(screen.getByTestId('redirect').props.children).toBe('/(onboarding)/welcome');
  });

  it('n’envoie plus vers l’onboarding une fois le profil enregistré', async () => {
    harness.setDraft(READY_DRAFT);
    const onboarding = await harness.renderScreen(<CalorieModeScreen />);
    await fireEvent.press(onboarding.getByTestId('step-primary'));

    const screen = await harness.renderScreen(<RootScreen />);

    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.getByTestId('today-budget')).toBeTruthy();
  });

  it('recalcule les chiffres depuis le profil, sans les relire en base', async () => {
    harness.setDraft(READY_DRAFT);
    const onboarding = await harness.renderScreen(<CalorieModeScreen />);
    await fireEvent.press(onboarding.getByTestId('step-primary'));

    const profile = harness.repositories.profile.get();
    const expected = profile ? buildCaloriePlan(profile) : undefined;
    const screen = await harness.renderScreen(<RootScreen />);

    // Journal vide : le restant vaut exactement l'objectif calculé.
    expect(screen.getByTestId('budget-remaining').props.children).toBe(
      formatKcal(expected?.target.targetKcal ?? 0),
    );
  });

  it('reflète immédiatement un changement de poids : rien n’est figé', async () => {
    harness.setDraft(READY_DRAFT);
    const onboarding = await harness.renderScreen(<CalorieModeScreen />);
    await fireEvent.press(onboarding.getByTestId('step-primary'));

    const before = await harness.renderScreen(<RootScreen />);
    const targetBefore = before.getByTestId('budget-remaining').props.children;

    const stored = harness.repositories.profile.get();
    if (stored) {
      harness.repositories.profile.save({ ...stored, currentWeightKg: 70 });
    }

    const after = await harness.renderScreen(<RootScreen />);

    expect(after.getByTestId('budget-remaining').props.children).not.toBe(targetBefore);
  });
});
