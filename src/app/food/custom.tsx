import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { Button, Callout, Text, TextField } from '@/components/ui';
import { useCustomFoods } from '@/hooks/use-food-library';
import { formatKcal } from '@/lib/format';
import { useFoodDraftStore } from '@/stores/food-draft';

/**
 * Saisie d'un aliment maison.
 *
 * C'est le **repli universel** de la phase : produit inconnu d'Open Food Facts,
 * fiche incomplète, réseau absent, ou recherche désactivée — dans tous les cas,
 * cet écran permet de continuer sa journée (PHASES_2_A_5 §4.7). Il ne dépend de
 * rien d'autre que de la base locale.
 *
 * Il sert aussi de **correction** d'une fiche collaborative. Dans ce cas, il
 * crée un aliment `custom` distinct plutôt que de modifier la ligne Open Food
 * Facts : la donnée corrigée est celle de l'utilisateur, elle ne se mélange pas
 * à une base sous ODbL (voir `src/data/remote/licence.ts`).
 */
export default function CustomFoodScreen() {
  const router = useRouter();
  const draft = useFoodDraftStore((state) => state.draft);
  const pendingMealType = useFoodDraftStore((state) => state.pendingMealType);
  const clearDraft = useFoodDraftStore((state) => state.clear);
  const library = useCustomFoods();

  const prefill = draft?.nutritionPer100 ?? {};
  const [name, setName] = useState(draft?.name ?? '');
  const [brand, setBrand] = useState(draft?.brand ?? '');
  const [kcal, setKcal] = useState(toInput(prefill.kcal));
  const [protein, setProtein] = useState(toInput(prefill.proteinG));
  const [carbs, setCarbs] = useState(toInput(prefill.carbsG));
  const [fat, setFat] = useState(toInput(prefill.fatG));

  const values = {
    kcal: toNumber(kcal),
    proteinG: toNumber(protein),
    carbsG: toNumber(carbs),
    fatG: toNumber(fat),
  };

  const hasName = name.trim().length > 0;
  const hasAllValues = Object.values(values).every((value) => value !== undefined);
  const canSubmit = hasName && hasAllValues;

  /**
   * Contrôle de cohérence, pas de conformité.
   *
   * L'énergie recalculée depuis les macros ne colle jamais exactement à celle
   * d'une étiquette — arrondis réglementaires, fibres, polyols. On signale donc
   * un écart franc, sans bloquer : c'est un doute qu'on partage, pas une règle
   * qu'on impose.
   */
  const energyFromMacros =
    hasAllValues && values.proteinG !== undefined
      ? Math.round(values.proteinG * 4 + (values.carbsG ?? 0) * 4 + (values.fatG ?? 0) * 9)
      : undefined;

  const isEnergyInconsistent =
    energyFromMacros !== undefined &&
    values.kcal !== undefined &&
    Math.abs(energyFromMacros - values.kcal) > Math.max(50, values.kcal * 0.25);

  function submit() {
    if (
      !canSubmit ||
      values.kcal === undefined ||
      values.proteinG === undefined ||
      values.carbsG === undefined ||
      values.fatG === undefined
    ) {
      return;
    }

    const created = library.create({
      name: name.trim(),
      ...(brand.trim() === '' ? {} : { brand: brand.trim() }),
      ...(draft?.barcode === undefined ? {} : { barcode: draft.barcode }),
      nutritionPer100: {
        kcal: values.kcal,
        proteinG: values.proteinG,
        carbsG: values.carbsG,
        fatG: values.fatG,
        ...(prefill.fiberG === undefined ? {} : { fiberG: prefill.fiberG }),
        ...(prefill.sugarG === undefined ? {} : { sugarG: prefill.sugarG }),
        ...(prefill.saturatedFatG === undefined ? {} : { saturatedFatG: prefill.saturatedFatG }),
        ...(prefill.sodiumMg === undefined ? {} : { sodiumMg: prefill.sodiumMg }),
      },
      ...(draft?.servingSizes === undefined || draft.servingSizes.length === 0
        ? {}
        : { servingSizes: draft.servingSizes }),
    });

    clearDraft();
    router.replace({
      pathname: '/food/add',
      params: {
        foodItemId: created.id,
        ...(pendingMealType === undefined ? {} : { mealType: pendingMealType }),
      },
    });
  }

  return (
    <Screen
      title="Saisir un aliment"
      subtitle="Recopie les valeurs de l’étiquette, pour 100 g ou 100 ml."
      testID="food-custom"
      footer={
        <Button
          label="Enregistrer l’aliment"
          onPress={submit}
          disabled={!canSubmit}
          testID="custom-submit"
        />
      }
    >
      {draft?.barcode !== undefined && draft.name !== '' ? (
        <Callout
          testID="custom-prefilled"
          title="Fiche pré-remplie"
          body="On a repris ce que la base connaissait de ce produit. Il ne te reste que les valeurs manquantes à compléter."
        />
      ) : null}

      <TextField label="Nom" value={name} onChangeText={setName} testID="custom-name" />
      <TextField
        label="Marque (facultatif)"
        value={brand}
        onChangeText={setBrand}
        testID="custom-brand"
      />

      <Text variant="caption" tone="textMuted">
        Valeurs pour 100 g
      </Text>

      <TextField
        label="Calories"
        suffix="kcal"
        value={kcal}
        onChangeText={setKcal}
        keyboardType="numeric"
        testID="custom-kcal"
      />
      <TextField
        label="Protéines"
        suffix="g"
        value={protein}
        onChangeText={setProtein}
        keyboardType="numeric"
        testID="custom-protein"
      />
      <TextField
        label="Glucides"
        suffix="g"
        value={carbs}
        onChangeText={setCarbs}
        keyboardType="numeric"
        testID="custom-carbs"
      />
      <TextField
        label="Lipides"
        suffix="g"
        value={fat}
        onChangeText={setFat}
        keyboardType="numeric"
        testID="custom-fat"
      />

      {isEnergyInconsistent && energyFromMacros !== undefined ? (
        <Callout
          testID="custom-energy-warning"
          tone="caution"
          title="Les chiffres ne collent pas tout à fait"
          body={`Tes macros représentent environ ${formatKcal(energyFromMacros)}, contre ${formatKcal(values.kcal ?? 0)} saisies. Vérifie l’étiquette — tu peux enregistrer quand même.`}
        />
      ) : null}

      {!hasAllValues ? (
        <View style={styles.hint}>
          <Text variant="caption" tone="textMuted" testID="custom-missing-hint">
            Les quatre valeurs sont nécessaires : sans elles, l’aliment ne pourrait pas être compté
            dans tes totaux.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

/** Une valeur absente reste un champ vide : on n'affiche jamais un zéro inventé. */
function toInput(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function toNumber(value: string): number | undefined {
  const parsed = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

const styles = StyleSheet.create({
  hint: { gap: 4 },
});
