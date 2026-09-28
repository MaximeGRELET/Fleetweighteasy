import { render } from '@testing-library/react-native';

import BiometricsScreen from '@/app/(onboarding)/biometrics';
import RecipeDetailScreen from '@/app/recipes/[id]';
import { FoodRow } from '@/components/food/food-row';
import { RecipeCard } from '@/components/recipes/recipe-card';
import { OptionCard, TextField } from '@/components/ui';
import { ALLERGEN_LABELS } from '@/domain/recipes/allergens';
import { RECIPES } from '@/domain/recipes/content/recipes';
import { resolveRecipe } from '@/domain/recipes/nutrition';
import { formatIsoDate, formatKcal } from '@/lib/format';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';

import { buildFoodItem, buildStoredProfile } from '../integration/helpers/fixtures';
import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { setLocalSearchParams } from '../support/router-mock';

/**
 * Ce que lisent les lecteurs d'écran.
 *
 * Le piège visé : l'étiquette d'un élément cliquable **remplace** le texte de
 * ses enfants. Une information affichée mais absente de l'étiquette n'existe
 * pas pour qui utilise TalkBack ou VoiceOver. Ces tests lisent donc
 * l'étiquette, jamais l'écran.
 */
function labelOf(element: { props: { accessibilityLabel?: string } }): string {
  return element.props.accessibilityLabel ?? '';
}

describe('carte recette', () => {
  const withAllergens = RECIPES.map(resolveRecipe).find(
    (recipe) => recipe.allergens.length > 0,
  ) as ReturnType<typeof resolveRecipe>;

  it('annonce les allergènes, juste après le nom', async () => {
    const screen = await render(
      <RecipeCard recipe={withAllergens} onPress={() => undefined} testID="card" />,
    );
    const label = labelOf(screen.getByTestId('card'));
    const allergens = withAllergens.allergens.map((allergen) => ALLERGEN_LABELS[allergen]);

    expect(label.startsWith(`${withAllergens.name}. Contient : ${allergens.join(', ')}.`)).toBe(
      true,
    );
  });

  it('annonce aussi le temps, l’énergie et les macros affichés', async () => {
    const screen = await render(
      <RecipeCard recipe={withAllergens} onPress={() => undefined} testID="card" />,
    );
    const label = labelOf(screen.getByTestId('card'));
    const { nutritionPerServing: nutrition } = withAllergens;

    expect(label).toContain(`${withAllergens.prepTimeMin} min`);
    expect(label).toContain(`${formatKcal(nutrition.kcal)} par portion`);
    expect(label).toContain(`${nutrition.proteinG} g de protéines`);
    expect(label).toContain(`${nutrition.fatG} g de lipides`);
  });

  it('ne parle pas d’allergènes quand il n’y en a pas', async () => {
    const without = RECIPES.map(resolveRecipe).find((recipe) => recipe.allergens.length === 0);
    const screen = await render(
      <RecipeCard
        recipe={without as ReturnType<typeof resolveRecipe>}
        onPress={() => undefined}
        testID="card"
      />,
    );

    expect(labelOf(screen.getByTestId('card'))).not.toContain('Contient');
  });
});

describe('ligne d’aliment', () => {
  it('annonce l’énergie et l’origine collaborative de la donnée', async () => {
    const item = buildFoodItem({ source: 'off', verified: false, brand: 'Marque' });
    const screen = await render(<FoodRow item={item} onPress={() => undefined} testID="row" />);
    const label = labelOf(screen.getByTestId('row'));

    expect(label).toContain(`${item.name}, Marque`);
    expect(label).toContain(`${formatKcal(item.nutritionPer100.kcal)} pour 100 g`);
    expect(label).toContain('Donnée collaborative');
    expect(label).not.toContain('hors ligne');
  });

  it('annonce un aliment saisi soi-même, disponible hors ligne', async () => {
    const item = buildFoodItem({ source: 'custom', verified: true, brand: undefined });
    const screen = await render(
      <FoodRow item={item} onPress={() => undefined} availableOffline testID="row" />,
    );
    const label = labelOf(screen.getByTestId('row'));

    expect(label).toContain('saisi toi-même');
    expect(label).toContain('Disponible hors ligne');
  });
});

describe('carte d’option', () => {
  it('annonce la recommandation et la description', async () => {
    const screen = await render(
      <OptionCard
        label="Modéré"
        description="Environ 0,5 kg par semaine"
        recommended
        selected={false}
        onPress={() => undefined}
        testID="option"
      />,
    );

    expect(labelOf(screen.getByTestId('option'))).toBe(
      'Modéré. recommandé. Environ 0,5 kg par semaine',
    );
  });

  it('donne l’état sélectionné sous les deux clés, Android et iOS', async () => {
    const screen = await render(
      <OptionCard label="Modéré" selected onPress={() => undefined} testID="option" />,
    );

    expect(screen.getByTestId('option').props.accessibilityState).toEqual({
      checked: true,
      selected: true,
    });
    expect(labelOf(screen.getByTestId('option'))).toBe('Modéré');
  });
});

describe('champ de saisie', () => {
  it('rattache l’unité à l’étiquette et l’aide à l’indication', async () => {
    const screen = await render(
      <TextField
        label="Poids"
        suffix="kg"
        hint="Le matin, idéalement."
        value=""
        onChangeText={() => undefined}
        testID="field"
      />,
    );
    const field = screen.getByTestId('field');

    expect(field.props.accessibilityLabel).toBe('Poids, en kg');
    expect(field.props.accessibilityHint).toBe('Le matin, idéalement.');
  });

  it('fait passer l’erreur avant l’aide', async () => {
    const screen = await render(
      <TextField
        label="Poids"
        hint="Le matin, idéalement."
        error="Indique ton poids en kilogrammes."
        value=""
        onChangeText={() => undefined}
        testID="field"
      />,
    );
    const field = screen.getByTestId('field');

    expect(field.props.accessibilityLabel).toBe('Poids');
    expect(field.props.accessibilityHint).toBe('Indique ton poids en kilogrammes.');
  });
});

describe('écrans', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('annonce la date de naissance choisie, pas seulement le nom du champ', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    harness.setDraft({ birthDate: '1990-05-12' });
    const screen = await harness.renderScreen(<BiometricsScreen />);

    expect(labelOf(screen.getByTestId('birthdate-trigger'))).toBe(
      `Date de naissance : ${formatIsoDate('1990-05-12')}`,
    );
  });

  it('dit quand la date de naissance n’est pas encore renseignée', async () => {
    harness.repositories.consent.grant(PRIVACY_POLICY_VERSION);
    const screen = await harness.renderScreen(<BiometricsScreen />);

    expect(labelOf(screen.getByTestId('birthdate-trigger'))).toBe(
      'Date de naissance : non renseignée',
    );
  });

  it('nomme les boutons « − » et « + » des portions', async () => {
    harness.repositories.profile.save(buildStoredProfile());
    setLocalSearchParams({ id: 'red_lentil_dahl' });
    const screen = await harness.renderScreen(<RecipeDetailScreen />);

    expect(labelOf(screen.getByTestId('recipe-portions-less'))).toBe('Une demi-portion de moins');
    expect(labelOf(screen.getByTestId('recipe-portions-more'))).toBe('Une demi-portion de plus');
  });
});
