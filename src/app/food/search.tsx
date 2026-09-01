import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FoodRow } from '@/components/food/food-row';
import { SourceNotice } from '@/components/food/source-notice';
import { Screen } from '@/components/layout/screen';
import { Button, Text, TextField } from '@/components/ui';
import type { FoodItem } from '@/domain/food/types';
import { MIN_SEARCH_LENGTH, useFoodSearch } from '@/hooks/use-food-catalog';
import { ODBL_ATTRIBUTION_SHORT } from '@/lib/attribution';
import { readMealTypeParam } from '@/lib/route-params';
import { explainSourceError } from '@/lib/messages/food-source';
import { useFoodDraftStore } from '@/stores/food-draft';

/**
 * Recherche d'un aliment.
 *
 * L'écran est construit autour d'une asymétrie assumée : le cache local répond
 * instantanément et hors ligne, la source distante répond peut-être. Les
 * résultats locaux s'affichent donc **avant** et **indépendamment** de l'appel
 * réseau — une panne de réseau retire des résultats supplémentaires, elle ne
 * vide jamais l'écran (PHASES_2_A_5 §4.7).
 */
export default function FoodSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mealType?: string }>();
  const mealType = readMealTypeParam(params.mealType);

  const [query, setQuery] = useState('');
  const search = useFoodSearch(query);
  const startBlank = useFoodDraftStore((state) => state.startBlank);

  function openItem(item: FoodItem) {
    router.push({
      pathname: '/food/add',
      params: { foodItemId: item.id, ...(mealType === undefined ? {} : { mealType }) },
    });
  }

  function openManualEntry() {
    startBlank(mealType === undefined ? {} : { mealType });
    router.push('/food/custom');
  }

  return (
    <Screen
      testID="food-search"
      title="Chercher un aliment"
      subtitle="Tape un nom, scanne un code-barres, ou saisis l’aliment toi-même."
    >
      <TextField
        label="Nom du produit"
        value={query}
        onChangeText={setQuery}
        placeholder="Riz basmati, yaourt nature…"
        testID="search-input"
      />

      <View style={styles.actions}>
        <Button
          label="Scanner un code-barres"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/food/scan',
              params: mealType === undefined ? {} : { mealType },
            })
          }
          testID="search-scan"
        />
        <Button
          label="Saisir un aliment maison"
          variant="quiet"
          onPress={openManualEntry}
          testID="search-manual"
        />
      </View>

      {search.isTooShort ? (
        <Text variant="caption" tone="textMuted" testID="search-hint">
          Saisis au moins {MIN_SEARCH_LENGTH} caractères.
        </Text>
      ) : null}

      {search.cached.length > 0 ? (
        <View style={styles.group} testID="search-cached">
          <Text variant="caption" tone="textMuted">
            Déjà dans tes aliments — disponibles hors ligne
          </Text>
          {search.cached.map((item) => (
            <FoodRow
              key={item.id}
              item={item}
              availableOffline
              onPress={openItem}
              testID={`search-result-${item.id}`}
            />
          ))}
        </View>
      ) : null}

      {search.isSearching ? (
        <View style={styles.loading} testID="search-loading">
          <ActivityIndicator />
          <Text variant="caption" tone="textMuted">
            Recherche en ligne…
          </Text>
        </View>
      ) : null}

      {search.remote.length > 0 ? (
        <View style={styles.group} testID="search-remote">
          <Text variant="caption" tone="textMuted">
            Résultats en ligne
          </Text>
          {search.remote.map((item) => (
            <FoodRow
              key={item.id}
              item={item}
              onPress={openItem}
              testID={`search-result-${item.id}`}
            />
          ))}
          <Text variant="caption" tone="textMuted">
            {ODBL_ATTRIBUTION_SHORT}
          </Text>
        </View>
      ) : null}

      {/* Un échec réseau est dit, jamais avalé — et il propose toujours une
          issue, ici la saisie manuelle. */}
      {search.error ? (
        <SourceNotice
          testID="search-error"
          message={explainSourceError(search.error)}
          onManualEntry={openManualEntry}
        />
      ) : null}

      {search.isEmpty && !search.error ? (
        <View style={styles.group} testID="search-empty">
          <Text variant="body" tone="textMuted">
            Aucun aliment ne correspond. Tu peux le saisir toi-même : il rejoindra tes aliments et
            sera proposé les fois suivantes.
          </Text>
          <Button
            label="Saisir cet aliment"
            onPress={openManualEntry}
            testID="search-empty-manual"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
  group: { gap: 8 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
