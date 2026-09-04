import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StepScreen } from '@/components/onboarding/step-screen';
import { Button, Chip, OptionCard, Text, TextField } from '@/components/ui';
import type { DietType } from '@/domain/profile/types';
import { ALLERGEN_CHOICES } from '@/domain/recipes/allergens';
import { useOnboarding } from '@/hooks/use-onboarding';
import { nextStep, onboardingRoute, stepProgress } from '@/lib/onboarding-steps';

const DIETS: { value: DietType; label: string; description: string }[] = [
  { value: 'omnivore', label: 'Omnivore', description: 'Aucune exclusion particulière.' },
  {
    value: 'flexitarian',
    label: 'Flexitarien',
    description: 'Peu de viande, sans l’exclure totalement.',
  },
  { value: 'pescatarian', label: 'Pescétarien', description: 'Poisson oui, viande non.' },
  { value: 'vegetarian', label: 'Végétarien', description: 'Ni viande ni poisson.' },
  { value: 'vegan', label: 'Végétalien', description: 'Aucun produit d’origine animale.' },
];

/**
 * Allergènes proposés — le **vocabulaire exact** que le filtrage des recettes
 * sait exclure (Phase 7).
 *
 * La liste vient de `ALLERGEN_CHOICES` et n'est pas recopiée ici : une puce qui
 * ne correspondrait à aucun allergène du catalogue donnerait l'illusion d'une
 * protection sans en offrir aucune. Le sésame, allergène réglementé présent
 * dans le houmous, y figure désormais — il manquait aux propositions.
 */
const COMMON_ALLERGIES = ALLERGEN_CHOICES;

const COMMON_DISLIKES = ['Coriandre', 'Champignons', 'Olives', 'Foie', 'Chou', 'Anchois'];

/**
 * Écran 8 — alimentation.
 *
 * Ces réponses n'entrent dans aucun calcul : elles filtrent les recettes en
 * Phase 7. Tout est facultatif.
 */
export default function DietScreen() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const [customAllergy, setCustomAllergy] = useState('');
  const [customDislike, setCustomDislike] = useState('');

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const addCustom = (
    list: string[],
    raw: string,
    apply: (next: string[]) => void,
    clear: () => void,
  ) => {
    const value = raw.trim();

    if (value.length === 0 || list.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      clear();
      return;
    }

    apply([...list, value]);
    clear();
  };

  return (
    <StepScreen
      testID="onboarding-diet"
      title="Et côté assiette ?"
      subtitle="Pour ne jamais te proposer une recette que tu ne peux pas ou ne veux pas manger."
      progress={stepProgress('diet', draft.goalType)}
      primaryLabel="Continuer"
      primaryDisabled={draft.dietType === undefined}
      onPrimary={() => {
        const next = nextStep('diet', draft.goalType);
        if (next) {
          router.push(onboardingRoute(next));
        }
      }}
    >
      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">
          Régime alimentaire
        </Text>
        {DIETS.map((diet) => (
          <OptionCard
            key={diet.value}
            testID={`diet-${diet.value}`}
            label={diet.label}
            description={diet.description}
            selected={draft.dietType === diet.value}
            onPress={() => update({ dietType: diet.value })}
          />
        ))}
      </View>

      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">
          Allergies et intolérances
        </Text>
        <View style={styles.chips}>
          {dedupe([...COMMON_ALLERGIES, ...draft.allergies]).map((allergy) => (
            <Chip
              key={allergy}
              testID={`allergy-${allergy}`}
              label={allergy}
              selected={draft.allergies.includes(allergy)}
              onPress={() => update({ allergies: toggle(draft.allergies, allergy) })}
            />
          ))}
        </View>
        <View style={styles.addRow}>
          <View style={styles.addField}>
            <TextField
              testID="custom-allergy-field"
              label="Autre allergie"
              value={customAllergy}
              onChangeText={setCustomAllergy}
              placeholder="Kiwi…"
              hint="Utilisée pour t’en souvenir, mais pas pour filtrer les recettes."
            />
          </View>
          <Button
            testID="add-allergy"
            label="Ajouter"
            variant="secondary"
            onPress={() =>
              addCustom(
                draft.allergies,
                customAllergy,
                (allergies) => update({ allergies }),
                () => setCustomAllergy(''),
              )
            }
          />
        </View>
      </View>

      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">
          Aliments que tu n’aimes pas
        </Text>
        <View style={styles.chips}>
          {dedupe([...COMMON_DISLIKES, ...draft.dislikes]).map((dislike) => (
            <Chip
              key={dislike}
              testID={`dislike-${dislike}`}
              label={dislike}
              selected={draft.dislikes.includes(dislike)}
              onPress={() => update({ dislikes: toggle(draft.dislikes, dislike) })}
            />
          ))}
        </View>
        <View style={styles.addRow}>
          <View style={styles.addField}>
            <TextField
              testID="custom-dislike-field"
              label="Autre aliment"
              value={customDislike}
              onChangeText={setCustomDislike}
              placeholder="Betterave…"
            />
          </View>
          <Button
            testID="add-dislike"
            label="Ajouter"
            variant="secondary"
            onPress={() =>
              addCustom(
                draft.dislikes,
                customDislike,
                (dislikes) => update({ dislikes }),
                () => setCustomDislike(''),
              )
            }
          />
        </View>
      </View>
    </StepScreen>
  );
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  addField: { flex: 1 },
});
