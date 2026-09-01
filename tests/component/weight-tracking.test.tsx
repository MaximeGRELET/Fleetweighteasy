import { fireEvent } from '@testing-library/react-native';

import WeightScreen from '@/app/weight/index';
import { ADAPTIVE_MIN_WEIGHT_DELTA_KG } from '@/domain/progress/adaptive';
import { addDays } from '@/domain/progress/calendar';
import type { UserProfile } from '@/domain/profile/types';
import { formatKg } from '@/lib/format';
import { todayIsoDate } from '@/stores/session';

import { buildStoredProfile } from '../integration/helpers/fixtures';
import { createAppHarness, type AppHarness } from '../support/render-with-app';

/**
 * Écran de suivi du poids.
 *
 * Ces tests portent sur ce que la Phase 5 exige de visible : la tendance prime
 * sur les points bruts, une seule pesée par jour, les indicateurs sont corrects,
 * et le recalcul adaptatif est annoncé quand il se voit — mais tu en dessous
 * du seuil (PHASES_2_A_5 §5.6).
 *
 * L'écran est monté sur de vrais repositories adossés à SQLite en mémoire :
 * ce qui est vérifié ici est bien ce que l'app écrira.
 */
describe('suivi du poids', () => {
  let harness: AppHarness;
  const today = todayIsoDate();

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  function givenProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    const profile = buildStoredProfile(overrides);
    harness.repositories.profile.save(profile);
    return profile;
  }

  /** Historique de pesées, du plus ancien au plus récent, une par jour. */
  function givenWeights(weights: number[], endDate = today) {
    weights.forEach((weightKg, index) => {
      harness.repositories.weight.upsertForDate({
        date: addDays(endDate, index - (weights.length - 1)),
        weightKg,
      });
    });
  }

  describe('saisie', () => {
    it('enregistre la pesée du jour', async () => {
      givenProfile();
      const screen = await harness.renderScreen(<WeightScreen />);

      await fireEvent.changeText(screen.getByTestId('weight-field'), '71,2');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      expect(harness.repositories.weight.getByDate(today)?.weightKg).toBe(71.2);
    });

    it('accepte la virgule comme séparateur décimal', async () => {
      givenProfile();
      const screen = await harness.renderScreen(<WeightScreen />);

      await fireEvent.changeText(screen.getByTestId('weight-field'), '70,5');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      expect(harness.repositories.weight.getByDate(today)?.weightKg).toBe(70.5);
    });

    it('remplace la pesée du jour au lieu d’en empiler une seconde', async () => {
      givenProfile();
      givenWeights([72]);

      const screen = await harness.renderScreen(<WeightScreen />);
      await fireEvent.changeText(screen.getByTestId('weight-field'), '71');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      expect(harness.repositories.weight.getHistory()).toHaveLength(1);
      expect(harness.repositories.weight.getByDate(today)?.weightKg).toBe(71);
    });

    it('pré-remplit le champ et parle de correction quand le jour est déjà pesé', async () => {
      givenProfile();
      givenWeights([72.4]);

      const screen = await harness.renderScreen(<WeightScreen />);

      expect(screen.getByTestId('weight-field').props.value).toBe('72.4');
      expect(screen.getByText('Corriger ma pesée')).toBeTruthy();
    });

    it('refuse un poids hors des bornes du domaine, sans rien écrire', async () => {
      givenProfile();
      const screen = await harness.renderScreen(<WeightScreen />);

      await fireEvent.changeText(screen.getByTestId('weight-field'), '600');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      expect(harness.repositories.weight.getHistory()).toEqual([]);
      expect(screen.getByText(/Le poids doit être compris/)).toBeTruthy();
    });

    it('refuse une saisie non numérique', async () => {
      givenProfile();
      const screen = await harness.renderScreen(<WeightScreen />);

      await fireEvent.changeText(screen.getByTestId('weight-field'), 'beaucoup');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      expect(harness.repositories.weight.getHistory()).toEqual([]);
    });
  });

  describe('courbe et pédagogie', () => {
    it('affiche la courbe dès qu’il y a une pesée', async () => {
      givenProfile();
      givenWeights([72]);

      const screen = await harness.renderScreen(<WeightScreen />);

      expect(screen.getByTestId('weight-chart')).toBeTruthy();
    });

    it('explique pourquoi la ligne compte plus que les points', async () => {
      givenProfile();
      const screen = await harness.renderScreen(<WeightScreen />);

      expect(screen.getByTestId('weighing-guidance')).toBeTruthy();
    });

    it('signale une tendance encore non lissée plutôt que de la présenter comme établie', async () => {
      givenProfile();
      givenWeights([72]);

      const screen = await harness.renderScreen(<WeightScreen />);

      expect(screen.getByTestId('trend-thin')).toBeTruthy();
    });

    it('retire cet avertissement dès que la moyenne porte sur plusieurs pesées', async () => {
      givenProfile();
      givenWeights([72, 71.8, 71.9]);

      const screen = await harness.renderScreen(<WeightScreen />);

      expect(screen.queryByTestId('trend-thin')).toBeNull();
    });

    it('propose les trois périodes en choix exclusif', async () => {
      givenProfile();
      givenWeights([72]);

      const screen = await harness.renderScreen(<WeightScreen />);

      expect(screen.getByTestId('period-30d').props.accessibilityRole).toBe('radio');
      expect(screen.getByTestId('period-90d')).toBeTruthy();
      expect(screen.getByTestId('period-all')).toBeTruthy();
    });

    it('change de période sans perdre la courbe', async () => {
      givenProfile();
      givenWeights(Array.from({ length: 40 }, (_, index) => 75 - index * 0.05));

      const screen = await harness.renderScreen(<WeightScreen />);
      await fireEvent.press(screen.getByTestId('period-all'));

      expect(screen.getByTestId('weight-chart')).toBeTruthy();
    });
  });

  describe('indicateurs', () => {
    it('ne promet aucun rythme tant que le recul est insuffisant', async () => {
      givenProfile();
      givenWeights([72.5, 72.3, 72.1]);

      const screen = await harness.renderScreen(<WeightScreen />);

      expect(screen.getByTestId('indicator-rate')).toHaveTextContent(/Encore trop tôt/);
      expect(screen.getByTestId('status-insufficient_data')).toBeTruthy();
    });

    it('affiche la variation, le rythme réel et le rythme visé', async () => {
      givenProfile({ currentWeightKg: 75, weeklyRateKg: 0.5 });
      // Trente jours à −0,07 kg/jour, soit environ −0,49 kg par semaine.
      givenWeights(Array.from({ length: 30 }, (_, index) => 75 - index * 0.07));

      const screen = await harness.renderScreen(<WeightScreen />);

      expect(screen.getByTestId('indicator-change')).toHaveTextContent(/perdus/);
      expect(screen.getByTestId('indicator-rate')).toHaveTextContent(/0,49/);
      expect(screen.getByTestId('status-on_track')).toBeTruthy();
    });

    it('affiche la progression vers la cible quand elle est définie', async () => {
      givenProfile({ currentWeightKg: 75, targetWeightKg: 68 });
      givenWeights(Array.from({ length: 30 }, (_, index) => 75 - index * 0.1));

      const screen = await harness.renderScreen(<WeightScreen />);

      // La jauge annonce départ, poids courant et cible aux lecteurs d'écran :
      // une barre sans texte ne dit rien de la progression.
      const label = screen.getByLabelText(/Progression vers ton objectif/);

      expect(screen.getByTestId('indicator-goal')).toBeTruthy();
      // Comparaison sur la propriété brute, donc sans la normalisation des
      // blancs que RNTL applique au texte rendu : on utilise le formateur.
      expect(label.props.accessibilityLabel).toContain(formatKg(68));
      expect(label.props.accessibilityLabel).toContain(formatKg(75));
      // Le poids courant affiché est la tendance lissée (72,4 kg), pas la
      // dernière pesée brute (72,1 kg).
      expect(label.props.accessibilityLabel).toContain(formatKg(72.4));
      expect(screen.getByText(/au départ/)).toBeTruthy();
    });

    it('n’affiche aucune progression vers la cible quand aucune n’est fixée', async () => {
      givenProfile({ targetWeightKg: undefined, goalType: 'maintenance' });
      givenWeights([72, 72.1, 71.9]);

      const screen = await harness.renderScreen(<WeightScreen />);

      expect(screen.queryByTestId('indicator-goal')).toBeNull();
    });

    it('présente un plateau comme une étape banale, jamais comme un échec', async () => {
      givenProfile({ currentWeightKg: 72, weeklyRateKg: 0.5 });
      // Quatre semaines de poids stable, avec un déficit planifié.
      givenWeights(Array.from({ length: 28 }, () => 72));

      const screen = await harness.renderScreen(<WeightScreen />);

      const plateau = screen.getByTestId('status-plateau');
      expect(plateau).toHaveTextContent(/banale/);
      expect(plateau).toHaveTextContent(/pas un échec/);
    });
  });

  describe('recalcul adaptatif', () => {
    it('réaligne le profil sur la tendance, pas sur la dernière pesée', async () => {
      const profile = givenProfile({ currentWeightKg: 75 });
      givenWeights(
        Array.from({ length: 14 }, () => 72),
        addDays(today, -1),
      );

      const screen = await harness.renderScreen(<WeightScreen />);
      await fireEvent.changeText(screen.getByTestId('weight-field'), '72');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      const stored = harness.repositories.profile.get();

      expect(stored?.currentWeightKg).toBe(72);
      expect(stored?.currentWeightKg).not.toBe(profile.currentWeightKg);
    });

    it('ne se laisse pas entraîner par une pesée aberrante isolée', async () => {
      givenProfile({ currentWeightKg: 72 });
      givenWeights(
        Array.from({ length: 14 }, () => 72),
        addDays(today, -1),
      );

      const screen = await harness.renderScreen(<WeightScreen />);
      // Journée salée : la balance affiche 75 kg.
      await fireEvent.changeText(screen.getByTestId('weight-field'), '75');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      const stored = harness.repositories.profile.get();

      // La moyenne sur sept jours amortit le pic : le profil ne bouge pas de 3 kg.
      expect(stored?.currentWeightKg).toBeLessThan(72.5);
    });

    it('reste silencieux tant que l’objectif bouge à peine', async () => {
      givenProfile({ currentWeightKg: 72.5 });
      givenWeights(
        Array.from({ length: 14 }, () => 71.8),
        addDays(today, -1),
      );

      const screen = await harness.renderScreen(<WeightScreen />);
      await fireEvent.changeText(screen.getByTestId('weight-field'), '71,8');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      expect(screen.queryByTestId('adaptive-adaptive_target_updated')).toBeNull();
      // Le profil a bien suivi, sans le dire : les chiffres restent justes.
      expect(harness.repositories.profile.get()?.currentWeightKg).toBeCloseTo(71.8, 1);
    });

    it('explique l’ajustement dès qu’il devient perceptible', async () => {
      givenProfile({ currentWeightKg: 85, targetWeightKg: 70 });
      givenWeights(
        Array.from({ length: 14 }, () => 74),
        addDays(today, -1),
      );

      const screen = await harness.renderScreen(<WeightScreen />);
      await fireEvent.changeText(screen.getByTestId('weight-field'), '74');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      const notice = screen.getByTestId('adaptive-adaptive_target_updated');

      expect(notice).toHaveTextContent(/Ton objectif a été réajusté/);
      expect(notice).toHaveTextContent(/pas que tu as fait quoi que ce soit de travers/);
    });

    it('prévient sur l’écart cumulé, même quand le pas du jour est minuscule', async () => {
      // Profil ayant dérivé en silence : l'objectif a été annoncé à 95 kg, le
      // poids courant est descendu à 83,2 kg palier par palier. Le pas du jour
      // (0,2 kg) est très en dessous du seuil de réalignement, mais l'écart
      // depuis la dernière annonce, lui, dépasse largement les 50 kcal.
      givenProfile({ currentWeightKg: 83.2, lastNotifiedWeightKg: 95 });
      givenWeights(
        Array.from({ length: 14 }, () => 83),
        addDays(today, -1),
      );

      const screen = await harness.renderScreen(<WeightScreen />);
      await fireEvent.changeText(screen.getByTestId('weight-field'), '83');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      expect(screen.getByTestId('adaptive-adaptive_target_updated')).toBeTruthy();
      // La base d'annonce suit, pour que le prochain cumul reparte de zéro.
      expect(harness.repositories.profile.get()?.lastNotifiedWeightKg).toBe(83);
    });

    it('épingle la base d’annonce sans la faire suivre un réalignement silencieux', async () => {
      givenProfile({ currentWeightKg: 83 });
      givenWeights(
        Array.from({ length: 14 }, () => 82.4),
        addDays(today, -1),
      );

      const screen = await harness.renderScreen(<WeightScreen />);
      await fireEvent.changeText(screen.getByTestId('weight-field'), '82,4');
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      const stored = harness.repositories.profile.get();

      expect(screen.queryByTestId('adaptive-adaptive_target_updated')).toBeNull();
      expect(stored?.currentWeightKg).toBeCloseTo(82.4, 1);
      // La base reste au poids du dernier objectif montré, pas au poids réaligné.
      expect(stored?.lastNotifiedWeightKg).toBe(83);
    });

    it('ne touche à rien sous le seuil de réalignement', async () => {
      givenProfile({ currentWeightKg: 72 });

      const screen = await harness.renderScreen(<WeightScreen />);
      await fireEvent.changeText(
        screen.getByTestId('weight-field'),
        String(72 - (ADAPTIVE_MIN_WEIGHT_DELTA_KG - 0.1)),
      );
      await fireEvent.press(screen.getByTestId('weight-field-submit'));

      expect(harness.repositories.profile.get()?.currentWeightKg).toBe(72);
    });
  });
});
