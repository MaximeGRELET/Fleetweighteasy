import { fireEvent } from '@testing-library/react-native';

import CardioScreen from '@/app/training/cardio';
import TrainingScreen from '@/app/training/index';
import StrengthScreen from '@/app/training/strength';
import { estimateCardioKcal } from '@/domain/nutrition/calories-sport';
import { findMetEntry } from '@/domain/nutrition/mets-table';
import type { SportProfile, UserProfile } from '@/domain/profile/types';
import { formatKcal } from '@/lib/format';
import { todayIsoDate, useSessionStore } from '@/stores/session';

import { buildStoredProfile } from '../integration/helpers/fixtures';
import { createAppHarness, type AppHarness } from '../support/render-with-app';

/**
 * Sport, vu depuis les écrans.
 *
 * Ces tests portent sur ce que la Phase 8 exige de visible : saisie cardio avec
 * estimation, programme adapté au profil, journalisation de la musculation, et
 * intégration au bilan **selon le mode de calories déjà en place** — pas un
 * mode parallèle (PHASES_6_A_10 §8.9).
 */
describe('sport', () => {
  let harness: AppHarness;
  const today = todayIsoDate();

  beforeEach(() => {
    harness = createAppHarness();
    useSessionStore.getState().setSelectedDate(today);
  });

  afterEach(() => {
    harness.cleanup();
  });

  function sportProfile(overrides: Partial<SportProfile> = {}): SportProfile {
    return {
      practices: ['strength', 'cardio'],
      strengthEnvironments: ['gym'],
      cardioActivities: ['running'],
      ...overrides,
    };
  }

  function givenProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    const profile = buildStoredProfile({
      sportProfile: sportProfile(),
      trainingDaysPerWeek: 3,
      ...overrides,
    });

    harness.repositories.profile.save(profile);
    return profile;
  }

  describe('saisie cardio', () => {
    it('estime la dépense avant l’enregistrement', async () => {
      const profile = givenProfile({ currentWeightKg: 70 });

      const screen = await harness.renderScreen(<CardioScreen />);
      await fireEvent.press(screen.getByTestId('cardio-activity-running'));
      await fireEvent.press(screen.getByTestId('cardio-intensity-run_general'));

      const expected = estimateCardioKcal({
        metValue: findMetEntry('run_general')?.met ?? 0,
        weightKg: profile.currentWeightKg,
        durationMin: 30,
      });

      expect(screen.getByTestId('cardio-estimate')).toHaveTextContent(new RegExp(String(expected)));
    });

    it('présente le chiffre comme une estimation, jamais comme une mesure', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<CardioScreen />);
      await fireEvent.press(screen.getByTestId('cardio-intensity-walk_brisk'));

      expect(screen.getByTestId('cardio-estimate')).toHaveTextContent(/pas une mesure/);
      expect(screen.getByTestId('cardio-estimate')).toHaveTextContent(/souvent à la baisse/);
    });

    it('enregistre la séance avec sa dépense figée', async () => {
      const profile = givenProfile({ currentWeightKg: 70 });

      const screen = await harness.renderScreen(<CardioScreen />);
      await fireEvent.press(screen.getByTestId('cardio-intensity-walk_brisk'));
      await fireEvent.changeText(screen.getByTestId('cardio-duration'), '45');
      await fireEvent.press(screen.getByTestId('cardio-save'));

      const [entry] = harness.repositories.workout.getByDate(today);

      expect(entry.payload.type).toBe('cardio');
      expect(entry.estimatedKcalBurned).toBe(
        estimateCardioKcal({
          metValue: findMetEntry('walk_brisk')?.met ?? 0,
          weightKg: profile.currentWeightKg,
          durationMin: 45,
        }),
      );
    });

    /**
     * Même garantie que le snapshot nutritionnel : la dépense est figée à
     * l'enregistrement. Corriger son poids plus tard ne réécrit pas le passé.
     */
    it('ne recalcule pas une séance passée quand le poids change', async () => {
      givenProfile({ currentWeightKg: 70 });

      const screen = await harness.renderScreen(<CardioScreen />);
      await fireEvent.press(screen.getByTestId('cardio-intensity-walk_brisk'));
      await fireEvent.press(screen.getByTestId('cardio-save'));

      const before = harness.repositories.workout.getByDate(today)[0].estimatedKcalBurned;

      harness.repositories.profile.save(buildStoredProfile({ currentWeightKg: 95 }));

      expect(harness.repositories.workout.getByDate(today)[0].estimatedKcalBurned).toBe(before);
    });

    it('n’enregistre rien tant qu’aucune intensité n’est choisie', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<CardioScreen />);
      await fireEvent.press(screen.getByTestId('cardio-save'));

      expect(harness.repositories.workout.getByDate(today)).toEqual([]);
    });

    it('refuse une durée nulle', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<CardioScreen />);
      await fireEvent.press(screen.getByTestId('cardio-intensity-walk_brisk'));
      await fireEvent.changeText(screen.getByTestId('cardio-duration'), '0');
      await fireEvent.press(screen.getByTestId('cardio-save'));

      expect(harness.repositories.workout.getByDate(today)).toEqual([]);
    });

    it('change la liste d’intensités avec l’activité', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<CardioScreen />);
      await fireEvent.press(screen.getByTestId('cardio-activity-cycling'));

      expect(screen.getByTestId('cardio-intensity-bike_moderate')).toBeTruthy();
      expect(screen.queryByTestId('cardio-intensity-run_general')).toBeNull();
    });
  });

  describe('intégration au bilan', () => {
    it('dit que le sport n’est pas ajouté au budget en mode fixe', async () => {
      givenProfile({ calorieMode: 'fixed', currentWeightKg: 70 });
      harness.repositories.workout.add({
        date: today,
        payload: {
          type: 'cardio',
          activity: 'running',
          metEntryId: 'run_general',
          durationMin: 30,
        },
        estimatedKcalBurned: 300,
      });

      const screen = await harness.renderScreen(<TrainingScreen />);

      expect(screen.getByTestId('training-estimate')).toHaveTextContent(/ne sont pas ajoutées/);
    });

    it('dit que le sport est crédité en mode crédité', async () => {
      givenProfile({ calorieMode: 'credited', currentWeightKg: 70 });
      harness.repositories.workout.add({
        date: today,
        payload: {
          type: 'cardio',
          activity: 'running',
          metEntryId: 'run_general',
          durationMin: 30,
        },
        estimatedKcalBurned: 300,
      });

      const screen = await harness.renderScreen(<TrainingScreen />);

      expect(screen.getByTestId('training-estimate')).toHaveTextContent(/ajoutées à ton budget/);
      expect(screen.getByTestId('training-estimate')).toHaveTextContent(
        new RegExp(formatKcal(300).replace(/\s/g, '\\s')),
      );
    });

    it('affiche l’avertissement sport', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<TrainingScreen />);

      expect(screen.getByTestId('training-disclaimer')).toHaveTextContent(/en cas de douleur/i);
    });
  });

  describe('programme', () => {
    it('propose un programme de salle à qui s’entraîne en salle', async () => {
      givenProfile({ trainingDaysPerWeek: 3 });

      const screen = await harness.renderScreen(<TrainingScreen />);

      expect(screen.getByTestId('training-program')).toHaveTextContent(/salle/);
    });

    it('propose un programme sans matériel à qui s’entraîne chez lui', async () => {
      givenProfile({
        trainingDaysPerWeek: 3,
        sportProfile: sportProfile({ strengthEnvironments: ['home'] }),
      });

      const screen = await harness.renderScreen(<TrainingScreen />);

      expect(screen.getByTestId('training-program')).toHaveTextContent(/maison/);
    });

    it('ne propose rien à qui ne s’entraîne pas', async () => {
      givenProfile({ trainingDaysPerWeek: 0, sportProfile: undefined });

      const screen = await harness.renderScreen(<StrengthScreen />);

      expect(screen.getByTestId('strength-no-program')).toBeTruthy();
    });
  });

  describe('séance de musculation', () => {
    it('annonce que les consignes d’exécution ne sont pas encore là', async () => {
      // Laisser croire qu'un mouvement n'en demande pas serait pire que de
      // reconnaître que le contenu manque.
      givenProfile();

      const screen = await harness.renderScreen(<StrengthScreen />);

      expect(screen.getByTestId('strength-instructions-pending')).toHaveTextContent(
        /Consignes d’exécution à venir/,
      );
      expect(screen.getByTestId('strength-instructions-pending')).toHaveTextContent(
        /en cas de douleur/i,
      );
    });

    it('enregistre les séries réalisées', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<StrengthScreen />);
      await fireEvent.changeText(screen.getByTestId('strength-reps-dumbbell_bench_press'), '10');
      await fireEvent.changeText(screen.getByTestId('strength-weight-dumbbell_bench_press'), '20');
      await fireEvent.press(screen.getByTestId('strength-save'));

      const [entry] = harness.repositories.workout.getByDate(today);

      expect(entry.payload.type).toBe('strength');

      if (entry.payload.type === 'strength') {
        expect(entry.payload.exercises[0].name).toBe('Développé couché haltères');
        expect(entry.payload.exercises[0].sets[0]).toEqual({ reps: 10, weightKg: 20 });
      }
    });

    /**
     * Décision de la Phase 1, reprise ici : la musculation vise la composition
     * corporelle, pas la dépense. Elle n'ouvre donc aucun crédit alimentaire,
     * même en mode crédité.
     */
    it('n’ouvre aucun crédit calorique, même en mode crédité', async () => {
      givenProfile({ calorieMode: 'credited' });

      const screen = await harness.renderScreen(<StrengthScreen />);
      await fireEvent.changeText(screen.getByTestId('strength-reps-dumbbell_bench_press'), '10');
      await fireEvent.press(screen.getByTestId('strength-save'));

      const [entry] = harness.repositories.workout.getByDate(today);

      expect(entry.estimatedKcalBurned).toBeUndefined();
      expect(harness.repositories.workout.getEstimatedKcalForDate(today)).toBe(0);
    });

    it('propose une cible de progression d’après ce qui est saisi', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<StrengthScreen />);
      // Haut de fourchette atteint sur toutes les séries : on monte la charge.
      await fireEvent.changeText(screen.getByTestId('strength-reps-dumbbell_bench_press'), '12');
      await fireEvent.changeText(screen.getByTestId('strength-weight-dumbbell_bench_press'), '20');

      expect(screen.getByTestId('strength-progression-dumbbell_bench_press')).toHaveTextContent(
        /monte la charge/,
      );
      expect(screen.getByTestId('strength-progression-dumbbell_bench_press')).toHaveTextContent(
        /22.5 kg/,
      );
    });

    it('conseille de garder la charge quand la fourchette n’est pas tenue', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<StrengthScreen />);
      await fireEvent.changeText(screen.getByTestId('strength-reps-dumbbell_bench_press'), '9');
      await fireEvent.changeText(screen.getByTestId('strength-weight-dumbbell_bench_press'), '20');

      expect(screen.getByTestId('strength-progression-dumbbell_bench_press')).toHaveTextContent(
        /Garde cette charge/,
      );
    });

    it('n’enregistre rien quand aucune répétition n’est saisie', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<StrengthScreen />);
      await fireEvent.press(screen.getByTestId('strength-save'));

      expect(harness.repositories.workout.getByDate(today)).toEqual([]);
    });
  });
});
