import SummaryScreen from '@/app/(onboarding)/summary';
import { calculateCalorieTarget } from '@/domain/nutrition/energy';
import { buildUserProfile, type ProfileDraft } from '@/domain/profile/draft';
import { formatKcal } from '@/lib/format';

import { createAppHarness, type AppHarness } from '../support/render-with-app';

/**
 * La restitution est le seul écran où l'application rend des comptes sur ses
 * chiffres. Ces tests vérifient qu'elle ne tait jamais un garde-fou.
 */
const HEALTHY_DRAFT: Partial<ProfileDraft> = {
  goalType: 'weight_loss',
  sex: 'male',
  birthDate: '1996-01-15',
  heightCm: 180,
  currentWeightKg: 80,
  activityLevel: 'moderately_active',
  trainingDaysPerWeek: 3,
  dietType: 'omnivore',
  calorieMode: 'fixed',
};

/**
 * Femme âgée, très légère et sédentaire au maintien : sa dépense estimée passe
 * sous le plancher calorique, donc l'objectif ressort **au-dessus** de sa
 * dépense. C'est le cas qui ressemble le plus à un bug vu de l'utilisateur.
 */
const FLOOR_ABOVE_EXPENDITURE_DRAFT: Partial<ProfileDraft> = {
  goalType: 'maintenance',
  sex: 'female',
  birthDate: '1951-01-15',
  heightCm: 150,
  currentWeightKg: 42,
  activityLevel: 'sedentary',
  trainingDaysPerWeek: 0,
  dietType: 'omnivore',
  calorieMode: 'fixed',
};

describe('écran de restitution', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('renvoie au début si le brouillon est incomplet', async () => {
    const screen = await harness.renderScreen(<SummaryScreen />);

    expect(screen.getByTestId('redirect').props.children).toBe('/(onboarding)/goal');
  });

  it('affiche l’objectif, la chaîne de calcul et les macros', async () => {
    harness.setDraft(HEALTHY_DRAFT);
    const screen = await harness.renderScreen(<SummaryScreen />);

    expect(screen.getByTestId('summary-target').props.children).toContain('2');
    expect(screen.getByText('Métabolisme de base')).toBeTruthy();
    expect(screen.getByText('Dépense totale estimée')).toBeTruthy();
    expect(screen.getByText('Protéines')).toBeTruthy();
    expect(screen.getByText('Lipides')).toBeTruthy();
    expect(screen.getByText('Glucides')).toBeTruthy();
  });

  it('ne montre aucune section d’ajustement quand rien n’a été borné', async () => {
    harness.setDraft(HEALTHY_DRAFT);
    const screen = await harness.renderScreen(<SummaryScreen />);

    expect(screen.queryByTestId('summary-explanations')).toBeNull();
  });

  it('explique un rythme plafonné plutôt que de l’appliquer en silence', async () => {
    harness.setDraft({ ...HEALTHY_DRAFT, currentWeightKg: 90, weeklyRateKg: 2 });
    const screen = await harness.renderScreen(<SummaryScreen />);

    expect(screen.getByTestId('summary-explanations')).toBeTruthy();
    expect(screen.getByTestId('explanation-rate_capped')).toBeTruthy();
  });

  it('avertit sans encourager quand le poids cible mène à une corpulence trop basse', async () => {
    harness.setDraft({ ...HEALTHY_DRAFT, heightCm: 170, targetWeightKg: 49 });
    const screen = await harness.renderScreen(<SummaryScreen />);

    expect(screen.getByTestId('explanation-goal_leads_to_underweight')).toBeTruthy();
    expect(screen.getByText(/médecin ou à un diététicien/)).toBeTruthy();
  });

  describe('objectif au-dessus de la dépense estimée', () => {
    it('est bien le cas reproduit par ce brouillon', () => {
      const profile = buildUserProfile({
        allergies: [],
        dislikes: [],
        ...FLOOR_ABOVE_EXPENDITURE_DRAFT,
      } as ProfileDraft);
      const target = calculateCalorieTarget(profile, new Date('2026-03-15T00:00:00Z'));

      expect(target.targetKcal).toBeGreaterThan(target.tdeeKcal);
    });

    it('affiche l’explication dédiée, sans laisser croire à un bug', async () => {
      harness.setDraft(FLOOR_ABOVE_EXPENDITURE_DRAFT);
      const screen = await harness.renderScreen(<SummaryScreen />);

      expect(screen.getByTestId('explanation-floor_applied_above_expenditure')).toBeTruthy();
      expect(screen.getByText(/c’est voulu/)).toBeTruthy();
      expect(screen.getByText(/zone sûre pour ta santé/)).toBeTruthy();
    });

    it('présente l’écart comme ajouté, pas comme un déficit', async () => {
      harness.setDraft(FLOOR_ABOVE_EXPENDITURE_DRAFT);
      const screen = await harness.renderScreen(<SummaryScreen />);

      expect(screen.getByText('Écart appliqué')).toBeTruthy();
      expect(screen.queryByText('Déficit appliqué')).toBeNull();
      expect(screen.getByText(/Ajouté à ta dépense/)).toBeTruthy();
    });

    it('affiche l’objectif au plancher, pas la dépense estimée', async () => {
      harness.setDraft(FLOOR_ABOVE_EXPENDITURE_DRAFT);
      const screen = await harness.renderScreen(<SummaryScreen />);

      expect(screen.getByTestId('summary-target').props.children).toBe(formatKcal(1200));
    });
  });

  it('rappelle que l’application ne remplace pas un professionnel', async () => {
    harness.setDraft(HEALTHY_DRAFT);
    const screen = await harness.renderScreen(<SummaryScreen />);

    expect(screen.getByText(/ne pose aucun diagnostic/)).toBeTruthy();
  });
});
