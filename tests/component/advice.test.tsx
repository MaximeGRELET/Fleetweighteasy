import { fireEvent } from '@testing-library/react-native';

import AdviceScreen from '@/app/advice/index';
import RootScreen from '@/app/index';
import { SLIP_OVER_BUDGET_RATIO } from '@/domain/advice/context';
import { addDays } from '@/domain/progress/calendar';
import type { UserProfile } from '@/domain/profile/types';
import { todayIsoDate, useSessionStore } from '@/stores/session';

import { buildFoodItem, buildStoredProfile } from '../integration/helpers/fixtures';
import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock } from '../support/router-mock';

/**
 * Moteur de conseils, vu depuis les écrans.
 *
 * Ces tests portent sur ce que la Phase 6 exige de visible : un conseil du jour
 * choisi selon la situation, une section consultable, et une mise en garde de
 * santé qui passe devant tout le reste (PHASES_6_A_10 §6.8).
 */
describe('conseils', () => {
  let harness: AppHarness;
  const today = todayIsoDate();

  beforeEach(() => {
    harness = createAppHarness();
    useSessionStore.getState().setSelectedDate(today);
  });

  afterEach(() => {
    harness.cleanup();
  });

  function givenProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    const profile = buildStoredProfile(overrides);
    harness.repositories.profile.save(profile);
    return profile;
  }

  /** Une journée de journal, dont on choisit le total consommé. */
  function givenLoggedDay(date: string, kcal: number) {
    const item = harness.repositories.food.upsert(
      buildFoodItem({ nutritionPer100: { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 } }),
    );

    harness.repositories.foodLog.addEntry({
      date,
      mealType: 'lunch',
      foodItemId: item.id,
      quantityG: 100,
      snapshot: { name: item.name, kcal, proteinG: 5, carbsG: 10, fatG: 2 },
    });
  }

  /** Ancre l'ancienneté : une pesée ancienne suffit à ne plus être débutant. */
  function givenEstablishedUser(daysAgo = 60) {
    harness.repositories.weight.upsertForDate({ date: addDays(today, -daysAgo), weightKg: 74 });
    harness.repositories.weight.upsertForDate({ date: today, weightKg: 72.5 });
  }

  describe('conseil du jour', () => {
    it('accueille un nouvel utilisateur', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('advice-featured-getting_started__default')).toBeTruthy();
    });

    it('cesse de souhaiter la bienvenue à un utilisateur installé', async () => {
      givenProfile();
      givenEstablishedUser();

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.queryByTestId('advice-featured-getting_started__default')).toBeNull();
      expect(screen.getByTestId('today-advice')).toBeTruthy();
    });

    it('met en avant la reprise après un écart marqué', async () => {
      givenProfile();
      givenEstablishedUser();

      // Journée très au-dessus du budget : un vrai écart, pas du bruit.
      givenLoggedDay(today, Math.ceil(2000 * SLIP_OVER_BUDGET_RATIO) + 800);

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('advice-featured-recovery_after_slip__default')).toBeTruthy();
    });

    it('ne crie pas à l’écart pour un dépassement modéré', async () => {
      givenProfile();
      givenEstablishedUser();
      givenLoggedDay(today, 100);

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.queryByTestId('advice-featured-recovery_after_slip__default')).toBeNull();
    });

    it('met en avant la brique la plus prioritaire, pas la plus situationnelle', async () => {
      givenProfile({ goalType: 'weight_loss' });
      givenEstablishedUser();

      const screen = await harness.renderScreen(<RootScreen />);

      // `understanding_deficit__weight_loss` (60) devance les conseils
      // généraux : c'est l'ordre voulu par les priorités du contenu.
      expect(screen.getByTestId('advice-featured-understanding_deficit__weight_loss')).toBeTruthy();
    });
  });

  describe('bande de sécurité', () => {
    it('fait passer une mise en garde de santé devant le conseil du jour', async () => {
      // Poids cible menant à une corpulence sous le seuil sain.
      givenProfile({ heightCm: 180, currentWeightKg: 70, targetWeightKg: 55 });
      givenEstablishedUser();

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('advice-safety-goal_leads_to_underweight')).toBeTruthy();
      // Aucun conseil général ne s'affiche au-dessus d'une mise en garde.
      expect(screen.queryByTestId(/^advice-featured-/)).toBeNull();
    });

    it('reprend le texte déjà rédigé pour l’onboarding, sans le réécrire', async () => {
      givenProfile({ heightCm: 180, currentWeightKg: 70, targetWeightKg: 55 });
      givenEstablishedUser();

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.getByTestId('advice-safety-goal_leads_to_underweight')).toHaveTextContent(
        /parles-en à un médecin ou à un diététicien/,
      );
    });

    /**
     * Branchement de bout en bout : les révisions passent par le repository,
     * comme depuis l'app, et c'est l'historique qu'il a écrit qui déclenche le
     * signal — aucun événement n'est injecté à la main.
     */
    it('signale un poids cible revu à la baisse à plusieurs reprises', async () => {
      for (const targetWeightKg of [66, 64, 62]) {
        givenProfile({ targetWeightKg });
        harness.database.advanceMinutes(60 * 24 * 7);
      }
      givenEstablishedUser();

      const screen = await harness.renderScreen(<RootScreen />);

      expect(
        screen.getByTestId('advice-safety-risk_repeatedly_lowered_target_weight'),
      ).toBeTruthy();
      expect(screen.queryByTestId(/^advice-featured-/)).toBeNull();
    });

    it('ne signale rien pour une seule révision de l’objectif', async () => {
      givenProfile({ targetWeightKg: 66 });
      harness.database.advanceMinutes(60 * 24 * 7);
      givenProfile({ targetWeightKg: 64 });
      givenEstablishedUser();

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.queryByTestId(/^advice-safety-/)).toBeNull();
    });

    it('n’affiche aucune bande quand aucun garde-fou n’est actif', async () => {
      givenProfile();
      givenEstablishedUser();

      const screen = await harness.renderScreen(<RootScreen />);

      expect(screen.queryByTestId(/^advice-safety-/)).toBeNull();
    });
  });

  describe('section conseils', () => {
    it('liste les briques pertinentes', async () => {
      givenProfile({ goalType: 'weight_loss', dietType: 'omnivore' });
      givenEstablishedUser();

      const screen = await harness.renderScreen(<AdviceScreen />);

      expect(screen.getByTestId('advice-block-understanding_deficit__weight_loss')).toBeTruthy();
      expect(screen.getByTestId('advice-block-protein__omnivore')).toBeTruthy();
      expect(screen.getByTestId('advice-block-hydration__default')).toBeTruthy();
    });

    it('remplace le conseil général de pesée par le rappel quand il s’applique', async () => {
      givenProfile();
      // Seule trace d'usage : un repas ancien. Aucune pesée, jamais.
      givenLoggedDay(addDays(today, -60), 500);

      const screen = await harness.renderScreen(<AdviceScreen />);

      expect(screen.getByTestId('advice-block-weighing_fluctuations__reminder')).toBeTruthy();
      expect(screen.queryByTestId('advice-block-weighing_fluctuations__default')).toBeNull();
    });

    it('revient au conseil général une fois la pesée faite', async () => {
      givenProfile();
      givenEstablishedUser();

      const screen = await harness.renderScreen(<AdviceScreen />);

      expect(screen.getByTestId('advice-block-weighing_fluctuations__default')).toBeTruthy();
      expect(screen.queryByTestId('advice-block-weighing_fluctuations__reminder')).toBeNull();
    });

    it('adapte le conseil protéines au régime', async () => {
      givenProfile({ dietType: 'vegan' });
      givenEstablishedUser();

      const screen = await harness.renderScreen(<AdviceScreen />);

      expect(screen.getByTestId('advice-block-protein__vegan')).toBeTruthy();
      expect(screen.queryByTestId('advice-block-protein__omnivore')).toBeNull();
    });

    /**
     * Le plateau appartient à l'écran de suivi du poids, qui l'explique déjà
     * avec le nombre de semaines mesuré. Le moteur s'abstient pour que la même
     * chose ne soit pas lue deux fois le même jour.
     */
    it('laisse le plateau à l’écran de suivi du poids', async () => {
      givenProfile({ currentWeightKg: 72, weeklyRateKg: 0.5 });

      // Quatre semaines de poids stable : un plateau au sens de la Phase 5.
      for (let daysAgo = 27; daysAgo >= 0; daysAgo -= 1) {
        harness.repositories.weight.upsertForDate({ date: addDays(today, -daysAgo), weightKg: 72 });
      }

      const screen = await harness.renderScreen(<AdviceScreen />);

      expect(screen.queryByTestId('advice-block-plateau__default')).toBeNull();
    });

    it('ouvre aussi la section sur les mises en garde', async () => {
      givenProfile({ heightCm: 180, currentWeightKg: 70, targetWeightKg: 55 });
      givenEstablishedUser();

      const screen = await harness.renderScreen(<AdviceScreen />);

      expect(screen.getByTestId('advice-safety-goal_leads_to_underweight')).toBeTruthy();
    });

    it('reste accessible depuis le tableau du jour', async () => {
      givenProfile();
      givenEstablishedUser();

      const screen = await harness.renderScreen(<RootScreen />);
      await fireEvent.press(screen.getByTestId('today-advice-link'));

      expect(routerMock.push).toHaveBeenCalledWith('/advice');
    });
  });
});
