import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { Button, Text, TextField } from '@/components/ui';
import type { FoodItem } from '@/domain/food/types';
import { useFoodSearch } from '@/hooks/use-food-catalog';
import { useMeals } from '@/hooks/use-food-library';
import { useTheme } from '@/hooks/use-theme';
import { formatGrams, formatKcal } from '@/lib/format';

/** Quantité proposée à l'ajout d'un composant. */
const DEFAULT_COMPONENT_QUANTITY_G = 100;

interface Component {
  item: FoodItem;
  quantityG: number;
}

/**
 * Composition d'un repas prédéfini.
 *
 * Les composants sont choisis **parmi les aliments déjà connus localement** :
 * un repas dont un ingrédient ne serait pas en cache ne pourrait pas être
 * rejoué hors ligne, ce qui viderait la fonctionnalité de son intérêt. La
 * recherche distante reste disponible depuis l'écran de recherche, et tout
 * produit consulté rejoint le cache — donc cette liste.
 */
export default function NewMealScreen() {
  const router = useRouter();
  const theme = useTheme();
  const library = useMeals();

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [components, setComponents] = useState<Component[]>([]);

  // Volontairement le seul volet local de la recherche : voir l'en-tête.
  const search = useFoodSearch(query);

  const totalKcal = components.reduce(
    (total, component) => total + (component.item.nutritionPer100.kcal * component.quantityG) / 100,
    0,
  );

  const canSubmit = name.trim().length > 0 && components.length > 0;

  function addComponent(item: FoodItem) {
    setComponents((current) =>
      current.some((component) => component.item.id === item.id)
        ? current
        : [...current, { item, quantityG: DEFAULT_COMPONENT_QUANTITY_G }],
    );
    setQuery('');
  }

  function setQuantity(id: string, raw: string) {
    const parsed = Number(raw.replace(',', '.'));

    setComponents((current) =>
      current.map((component) =>
        component.item.id === id && Number.isFinite(parsed) && parsed > 0
          ? { ...component, quantityG: parsed }
          : component,
      ),
    );
  }

  function submit() {
    if (!canSubmit) {
      return;
    }

    library.create({
      name: name.trim(),
      items: components.map((component) => ({
        foodItemId: component.item.id,
        quantityG: component.quantityG,
      })),
    });

    router.replace('/meals');
  }

  return (
    <Screen
      title="Composer un repas"
      subtitle="Assemble des aliments une fois, ajoute-les ensuite en un tap."
      testID="meal-new"
      footer={
        <Button
          label="Enregistrer le repas"
          onPress={submit}
          disabled={!canSubmit}
          testID="meal-new-submit"
        />
      }
    >
      <TextField
        label="Nom du repas"
        value={name}
        onChangeText={setName}
        placeholder="Bol du midi"
        testID="meal-new-name"
      />

      {components.length > 0 ? (
        <View style={styles.group} testID="meal-new-components">
          <Text variant="caption" tone="textMuted">
            Composition — {formatKcal(totalKcal)} au total
          </Text>

          {components.map((component) => (
            <View
              key={component.item.id}
              style={[
                styles.component,
                { borderRadius: theme.radius.md, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.componentText}>
                <Text variant="body" numberOfLines={1}>
                  {component.item.name}
                </Text>
                <Text variant="caption" tone="textMuted">
                  {formatGrams(component.quantityG)} ·{' '}
                  {formatKcal((component.item.nutritionPer100.kcal * component.quantityG) / 100)}
                </Text>
              </View>

              <View style={styles.quantity}>
                <TextField
                  label="Quantité"
                  suffix="g"
                  value={String(component.quantityG)}
                  onChangeText={(value) => setQuantity(component.item.id, value)}
                  keyboardType="numeric"
                  testID={`meal-new-quantity-${component.item.id}`}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${component.item.name}`}
                testID={`meal-new-remove-${component.item.id}`}
                onPress={() =>
                  setComponents((current) =>
                    current.filter((entry) => entry.item.id !== component.item.id),
                  )
                }
                hitSlop={12}
              >
                <Text variant="caption" tone="textMuted">
                  Retirer
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <TextField
        label="Ajouter un aliment"
        value={query}
        onChangeText={setQuery}
        placeholder="Cherche dans tes aliments"
        testID="meal-new-search"
      />

      {search.cached.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          testID={`meal-new-add-${item.id}`}
          onPress={() => addComponent(item)}
          style={[
            styles.candidate,
            { borderRadius: theme.radius.md, borderColor: theme.colors.border },
          ]}
        >
          <Text variant="body" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="caption" tone="textMuted">
            {formatKcal(item.nutritionPer100.kcal)} pour 100 g
          </Text>
        </Pressable>
      ))}

      {!search.isTooShort && search.cached.length === 0 ? (
        <Text variant="caption" tone="textMuted" testID="meal-new-no-local">
          Aucun aliment de ta bibliothèque ne correspond. Cherche-le d’abord depuis l’écran de
          recherche : il rejoindra tes aliments et sera disponible ici.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  component: { gap: 8, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  componentText: { gap: 2 },
  quantity: { width: 160 },
  candidate: { padding: 12, gap: 2, borderWidth: StyleSheet.hairlineWidth },
});
