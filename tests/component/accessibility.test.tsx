import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import BiometricsScreen from '@/app/(onboarding)/biometrics';
import RecipeDetailScreen from '@/app/recipes/[id]';
import { FoodRow } from '@/components/food/food-row';
import { RecipeCard } from '@/components/recipes/recipe-card';
import { SourceNotice } from '@/components/food/source-notice';
import { Button, OptionCard, StatusMessage, Text, TextField } from '@/components/ui';
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

describe('titres', () => {
  it('annonce les variantes title et heading comme des titres', async () => {
    const screen = await render(
      <>
        <Text variant="title">Titre</Text>
        <Text variant="heading">Section</Text>
      </>,
    );

    expect(screen.getAllByRole('header')).toHaveLength(2);
  });

  it('ne fait pas d’un sous-titre ou d’un corps de texte un titre', async () => {
    const screen = await render(
      <>
        <Text variant="subheading">Libellé</Text>
        <Text variant="body">Corps</Text>
      </>,
    );

    expect(screen.queryAllByRole('header')).toHaveLength(0);
  });

  it('laisse un rôle explicite l’emporter', async () => {
    const screen = await render(
      <Text variant="title" accessibilityRole="radio">
        Choix
      </Text>,
    );

    expect(screen.queryAllByRole('header')).toHaveLength(0);
    expect(screen.getByRole('radio')).toBeTruthy();
  });
});

describe('annonces', () => {
  let announce: jest.SpyInstance;

  beforeEach(() => {
    // Le mock de React Native est déjà un `jest.fn` : `spyOn` le renvoie tel
    // quel, avec les appels des tests précédents. On repart de zéro.
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
  });

  afterEach(() => {
    announce.mockRestore();
  });

  it('annonce un message d’état dès qu’il apparaît, une seule fois', async () => {
    // Le parent se redessine (une saisie, un compteur) sans que le message
    // change : le lecteur d'écran ne doit pas le répéter à chaque frappe.
    function Parent() {
      const [count, setCount] = useState(0);

      return (
        <>
          <Button label={`Appuis : ${count}`} onPress={() => setCount(count + 1)} testID="bump" />
          <StatusMessage tone="primary" message="Séance enregistrée." />
        </>
      );
    }

    const screen = await render(<Parent />);
    await fireEvent.press(screen.getByTestId('bump'));
    await fireEvent.press(screen.getByTestId('bump'));

    expect(screen.getByText('Appuis : 2')).toBeTruthy();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Séance enregistrée.');
  });

  it('annonce l’erreur d’un champ, pas son aide', async () => {
    const screen = await render(
      <TextField label="Poids" hint="Le matin." value="" onChangeText={() => undefined} />,
    );
    expect(announce).not.toHaveBeenCalled();

    await screen.rerender(
      <TextField
        label="Poids"
        hint="Le matin."
        error="Indique ton poids en kilogrammes."
        value=""
        onChangeText={() => undefined}
      />,
    );

    expect(announce).toHaveBeenCalledWith('Indique ton poids en kilogrammes.');
  });

  it('annonce l’échec d’une source distante', async () => {
    await render(
      <SourceNotice
        message={{
          title: 'Pas de réseau',
          body: 'Réessaie plus tard.',
          offersRetry: true,
          offersManualEntry: true,
        }}
      />,
    );

    expect(announce).toHaveBeenCalledWith('Pas de réseau. Réessaie plus tard.');
  });

  it('annonce l’ajout d’une recette au journal', async () => {
    const harness = createAppHarness();
    try {
      harness.repositories.profile.save(buildStoredProfile());
      setLocalSearchParams({ id: 'red_lentil_dahl' });
      const screen = await harness.renderScreen(<RecipeDetailScreen />);

      await fireEvent.press(screen.getByTestId('recipe-log-lunch'));

      expect(announce).toHaveBeenCalledWith('Ajouté à ton déjeuner.');
    } finally {
      harness.cleanup();
    }
  });
});
