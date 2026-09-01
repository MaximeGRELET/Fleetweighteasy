import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReliabilityBadge } from '@/components/food/reliability-badge';
import { Screen } from '@/components/layout/screen';
import { Button, Callout, Chip, Text, TextField } from '@/components/ui';
import { MEAL_TYPE_LABELS } from '@/components/journal/meal-section';
import { snapshotForFoodItem } from '@/domain/journal/snapshot';
import { MEAL_TYPES, type MealType } from '@/domain/journal/types';
import { useJournal } from '@/hooks/use-journal';
import { useStoredFoodItem } from '@/hooks/use-food-item';
import { ODBL_ATTRIBUTION_SHORT } from '@/lib/attribution';
import { formatGrams, formatKcal } from '@/lib/format';
import { readMealTypeParam, readStringParam } from '@/lib/route-params';
import { useSessionStore } from '@/stores/session';

/** Quantité proposée par défaut, à défaut de portion usuelle connue. */
const DEFAULT_QUANTITY_G = 100;

/**
 * Ajout — ou correction — d'une entrée du journal.
 *
 * Un seul écran pour les deux gestes : ce sont les mêmes décisions (quelle
 * quantité, quel repas) et le même aperçu. Les distinguer aurait dupliqué la
 * saisie et le calcul de l'aperçu pour ne changer qu'un verbe.
 *
 * Aucun appel réseau : l'aliment a déjà été mis en cache au moment où il a été
 * consulté. Cet écran fonctionne donc hors ligne, y compris pour un produit
 * scanné une minute plus tôt avec du réseau (PHASES_2_A_5 §4.7).
 *
 * L'aperçu nutritionnel affiché est calculé par **la même fonction du domaine**
 * qui figera le snapshot à la validation (`snapshotForFoodItem`) : ce que
 * l'utilisateur lit avant de valider est exactement ce qui sera enregistré.
 */
export default function AddFoodEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    foodItemId?: string;
    mealType?: string;
    entryId?: string;
  }>();
  const selectedDate = useSessionStore((state) => state.selectedDate);
  const journal = useJournal(selectedDate);

  // En correction, tout se déduit de l'entrée : l'aliment d'origine, le repas
  // et la quantité déjà saisie. Rien n'est redemandé.
  const entryId = readStringParam(params.entryId);
  const existing =
    entryId === undefined ? undefined : journal.entries.find((e) => e.id === entryId);
  const isEditing = existing !== undefined;

  const item = useStoredFoodItem(existing?.foodItemId ?? readStringParam(params.foodItemId));
  const [mealType, setMealType] = useState<MealType>(
    existing?.mealType ?? readMealTypeParam(params.mealType) ?? 'lunch',
  );
  const [quantity, setQuantity] = useState(
    String(existing?.quantityG ?? item?.servingSizes[0]?.grams ?? DEFAULT_QUANTITY_G),
  );

  const quantityG = Number(quantity.replace(',', '.'));
  const isQuantityValid = Number.isFinite(quantityG) && quantityG > 0;

  const preview = useMemo(
    () => (item && isQuantityValid ? snapshotForFoodItem(item, quantityG) : undefined),
    [item, quantityG, isQuantityValid],
  );

  if (!item) {
    return (
      <Screen title="Aliment introuvable" testID="food-add">
        <Callout
          title="Cet aliment n’est plus disponible"
          body={
            isEditing
              ? 'L’aliment d’origine a été supprimé : cette entrée ne peut plus être corrigée sans inventer des chiffres. Supprime-la et ressaisis-la.'
              : 'Il a peut-être été supprimé depuis. Reviens à la recherche pour en choisir un autre.'
          }
        />
        <Button
          label={isEditing ? 'Retour au journal' : 'Retour à la recherche'}
          onPress={() => router.replace(isEditing ? '/' : '/food/search')}
        />
      </Screen>
    );
  }

  function confirm() {
    if (!item || !isQuantityValid) {
      return;
    }

    if (entryId !== undefined && isEditing) {
      journal.updateEntry(entryId, { quantityG, mealType });
    } else {
      journal.addFoodEntry({ item, quantityG, mealType });
    }

    // Retour au journal plutôt qu'à la recherche : l'utilisateur vient de
    // terminer son geste, il veut en voir l'effet.
    router.dismissAll?.();
    router.replace('/');
  }

  return (
    <Screen
      title={item.name}
      {...(item.brand === undefined ? {} : { subtitle: item.brand })}
      testID="food-add"
      footer={
        <Button
          label={isEditing ? 'Enregistrer la correction' : 'Ajouter au journal'}
          onPress={confirm}
          disabled={!isQuantityValid}
          testID="add-confirm"
        />
      }
    >
      <ReliabilityBadge verified={item.verified} source={item.source} testID="add-reliability" />

      <TextField
        label="Quantité"
        suffix="g"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
        testID="add-quantity"
        {...(isQuantityValid ? {} : { error: 'Saisis une quantité supérieure à zéro.' })}
      />

      {item.servingSizes.length > 0 ? (
        <View style={styles.group} testID="add-servings">
          <Text variant="caption" tone="textMuted">
            Portions usuelles
          </Text>
          <View style={styles.chips}>
            {item.servingSizes.map((serving) => (
              <Chip
                key={`${serving.label}-${serving.grams}`}
                label={`${serving.label} (${formatGrams(serving.grams)})`}
                selected={quantityG === serving.grams}
                onPress={() => setQuantity(String(serving.grams))}
                testID={`add-serving-${serving.grams}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">
          Repas
        </Text>
        <View style={styles.chips}>
          {MEAL_TYPES.map((type) => (
            <Chip
              key={type}
              label={MEAL_TYPE_LABELS[type]}
              selected={mealType === type}
              onPress={() => setMealType(type)}
              testID={`add-meal-${type}`}
            />
          ))}
        </View>
      </View>

      {preview ? (
        <View style={styles.group} testID="add-preview">
          <Text variant="numeric">{formatKcal(preview.kcal)}</Text>
          <Text variant="caption" tone="textMuted">
            {formatGrams(preview.proteinG)} de protéines · {formatGrams(preview.carbsG)} de glucides
            · {formatGrams(preview.fatG)} de lipides
          </Text>
        </View>
      ) : null}

      {item.source === 'off' ? (
        <Text variant="caption" tone="textMuted">
          {ODBL_ATTRIBUTION_SHORT}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
