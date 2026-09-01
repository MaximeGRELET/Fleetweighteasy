import { fireEvent } from '@testing-library/react-native';

import RootScreen from '@/app/index';
import { buildDailyBudget } from '@/domain/journal/daily-budget';
import type { UserProfile } from '@/domain/profile/types';
import { buildCaloriePlan } from '@/hooks/use-profile';
import { formatKcal } from '@/lib/format';
import { useSessionStore } from '@/stores/session';

import { buildFoodItem, buildStoredProfile } from '../integration/helpers/fixtures';
import { asRenderedText, createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock } from '../support/router-mock';

const TODAY = '2026-03-15';

/**
 * Tableau du jour.
 *
 * Ces tests portent sur ce que la phase exige de visible : le budget respecte
 * le `calorieMode`, le sport reste affiché même quand il ne compte pas, et la
 * vue alternative est accessible (PHASES_2_A_5 §4.6).
 *
 * Aucun n'utilise le réseau : cet écran n'en a pas besoin, et c'est justement
 * ce qu'on vérifie au passage.
 */
describe('tableau du jour', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    useSessionStore.getState().setSelectedDate(TODAY);
  });

  afterEach(() => {
    harness.cleanup();
  });

  function givenProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    const profile = buildStoredProfile(overrides);
    harness.repositories.profile.save(profile);
    return profile;
  }

  /** Une entrée de journal réelle, passée par le repository et son snapshot. */
  function givenLoggedFood(kcalPer100: number, quantityG: number) {
    const item = harness.repositories.food.upsert(
      buildFoodItem({
        nutritionPer100: { kcal: kcalPer100, proteinG: 10, carbsG: 20, fatG: 5 },
      }),
    );

    harness.repositories.foodLog.addEntry({
      date: TODAY,
      mealType: 'lunch',
      foodItemId: item.id,
      quantityG,
      snapshot: {
        name: item.name,
        kcal: Math.round((kcalPer100 * quantityG) / 100),
        proteinG: 10,
        carbsG: 20,
        fatG: 5,
      },
    });

    return item;
  }

  /** Une séance cardio, pour éprouver les deux modes de calories. */
  function givenWorkout(estimatedKcalBurned: number) {
    harness.repositories.workout.add({
      date: TODAY,
      payload: { type: 'cardio', activity: 'running', metEntryId: 'running_8kmh', durationMin: 30 },
      estimatedKcalBurned,
    });
  }

  it('affiche le restant du jour, journal vide', async () => {
    const profile = givenProfile({ calorieMode: 'fixed' });
    const plan = buildCaloriePlan(profile);

    const screen = await harness.renderScreen(<RootScreen />);

    expect(screen.getByTestId('budget-remaining').props.children).toBe(
      formatKcal(plan.target.targetKcal),
    );
  });

  it('déduit ce qui a été consommé', async () => {
    const profile = givenProfile({ calorieMode: 'fixed' });
    const plan = buildCaloriePlan(profile);
    givenLoggedFood(200, 250);

    const screen = await harness.renderScreen(<RootScreen />);

    expect(screen.getByTestId('budget-remaining').props.children).toBe(
      formatKcal(plan.target.targetKcal - 500),
    );
  });

  describe('mode fixe', () => {
    it('n’ajoute pas le sport au budget', async () => {
      const profile = givenProfile({ calorieMode: 'fixed' });
      const plan = buildCaloriePlan(profile);
      givenWorkout(400);

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('budget-remaining').props.children).toBe(
        formatKcal(plan.target.targetKcal),
      );
    });

    it('affiche quand même la séance, en le disant clairement', async () => {
      // Masquer le sport donnerait l'impression qu'il a été oublié.
      givenProfile({ calorieMode: 'fixed' });
      givenWorkout(400);

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('budget-exercise')).toHaveTextContent(/non ajoutées à ce budget/);
    });

    it('explique pourquoi le budget ne bouge pas', async () => {
      givenProfile({ calorieMode: 'fixed' });

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('budget-mode')).toHaveTextContent(/ne bouge pas/);
    });
  });

  describe('mode crédité', () => {
    it('ajoute la dépense estimée au budget', async () => {
      const profile = givenProfile({ calorieMode: 'credited' });
      const plan = buildCaloriePlan(profile);
      givenWorkout(400);

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('budget-remaining').props.children).toBe(
        formatKcal(plan.target.targetKcal + 400),
      );
    });

    it('annonce la part créditée', async () => {
      givenProfile({ calorieMode: 'credited' });
      givenWorkout(400);

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('budget-exercise')).toHaveTextContent(/créditées par tes séances/);
    });
  });

  describe('vue alternative — transparence', () => {
    it('propose de voir l’autre mode sans changer le réglage', async () => {
      const profile = givenProfile({ calorieMode: 'fixed' });
      const plan = buildCaloriePlan(profile);
      givenWorkout(400);

      const screen = await harness.renderScreen(<RootScreen />);
      await fireEvent.press(screen.getByTestId('budget-toggle-view'));

      expect(screen.getByTestId('budget-remaining').props.children).toBe(
        formatKcal(plan.target.targetKcal + 400),
      );
      // Le réglage du profil n'a pas bougé : c'est une comparaison, pas un choix.
      expect(screen.getByTestId('budget-alternative-note')).toBeTruthy();
      expect(harness.repositories.profile.get()?.calorieMode).toBe('fixed');
    });

    it('revient à la vue du mode réglé', async () => {
      const profile = givenProfile({ calorieMode: 'fixed' });
      const plan = buildCaloriePlan(profile);
      givenWorkout(400);

      const screen = await harness.renderScreen(<RootScreen />);
      await fireEvent.press(screen.getByTestId('budget-toggle-view'));
      await fireEvent.press(screen.getByTestId('budget-toggle-view'));

      expect(screen.getByTestId('budget-remaining').props.children).toBe(
        formatKcal(plan.target.targetKcal),
      );
      expect(screen.queryByTestId('budget-alternative-note')).toBeNull();
    });

    it('propose la comparaison depuis le mode crédité aussi', async () => {
      givenProfile({ calorieMode: 'credited' });

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('budget-toggle-view')).toHaveTextContent(/sans crédit sportif/);
    });
  });

  describe('dépassement', () => {
    it('l’annonce sans dramatiser, et sans masquer le chiffre', async () => {
      const profile = givenProfile({ calorieMode: 'fixed' });
      const plan = buildCaloriePlan(profile);
      givenLoggedFood(1000, (plan.target.targetKcal + 300) / 10);

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByText('Tu as dépassé de')).toBeTruthy();
      expect(screen.getByTestId('budget-remaining').props.children).toBe(formatKcal(300));
    });
  });

  describe('repas de la journée', () => {
    it('affiche les quatre repas, même vides', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RootScreen />);

      // Les repas vides portent l'action « ajouter » : les masquer coûterait
      // un tap à chaque saisie.
      for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
        expect(screen.getByTestId(`section-${mealType}`)).toBeTruthy();
      }
    });

    it('regroupe les entrées par repas et somme leurs snapshots', async () => {
      givenProfile();
      givenLoggedFood(200, 250);

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('meal-lunch-kcal')).toHaveTextContent(
        asRenderedText(formatKcal(500)),
      );
      expect(screen.getByTestId('meal-dinner-kcal')).toHaveTextContent(
        asRenderedText(formatKcal(0)),
      );
    });

    it('ouvre la correction d’une entrée au tap', async () => {
      givenProfile();
      givenLoggedFood(200, 250);

      const screen = await harness.renderScreen(<RootScreen />);
      const entry = harness.repositories.foodLog.getByDate(TODAY)[0];
      await fireEvent.press(screen.getByTestId(`entry-edit-${entry?.id}`));

      expect(routerMock.push).toHaveBeenCalledWith({
        pathname: '/food/add',
        params: { entryId: entry?.id },
      });
    });

    it('supprime une entrée sans réseau et met les totaux à jour', async () => {
      // Suppression : chemin hors ligne obligatoire (PHASES_2_A_5 §4.7).
      const profile = givenProfile({ calorieMode: 'fixed' });
      const plan = buildCaloriePlan(profile);
      givenLoggedFood(200, 250);
      harness.foodSource.goOffline();

      const screen = await harness.renderScreen(<RootScreen />);
      const entry = harness.repositories.foodLog.getByDate(TODAY)[0];
      await fireEvent.press(screen.getByTestId(`entry-remove-${entry?.id}`));

      expect(harness.repositories.foodLog.getByDate(TODAY)).toEqual([]);
      expect(screen.getByTestId('budget-remaining').props.children).toBe(
        formatKcal(plan.target.targetKcal),
      );
      expect(harness.foodSource.calls.search + harness.foodSource.calls.lookup).toBe(0);
    });
  });

  it('affiche l’attribution Open Food Facts', async () => {
    // Obligation ODbL (PHASES_2_A_5 §4.2).
    givenProfile();

    const screen = await harness.renderScreen(<RootScreen />);

    expect(screen.getByTestId('odbl-attribution')).toHaveTextContent(/Open Food Facts/);
    expect(screen.getByTestId('odbl-attribution')).toHaveTextContent(/ODbL/);
  });

  it('affiche exactement ce que le domaine a calculé', async () => {
    // Garde-fou d'architecture : si l'écran se mettait à recalculer quoi que ce
    // soit, ce test le verrait diverger du domaine.
    const profile = givenProfile({ calorieMode: 'credited' });
    const plan = buildCaloriePlan(profile);
    givenLoggedFood(200, 250);
    givenWorkout(400);

    const expected = buildDailyBudget({
      mode: 'credited',
      targetKcal: plan.target.targetKcal,
      macros: plan.macros,
      consumed: harness.repositories.foodLog.getDailyTotals(TODAY),
      exerciseKcal: harness.repositories.workout.getEstimatedKcalForDate(TODAY),
    });

    const screen = await harness.renderScreen(<RootScreen />);

    expect(screen.getByTestId('budget-remaining').props.children).toBe(
      formatKcal(expected.active.remainingKcal),
    );
  });
});
