import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DailyAdvice } from '@/components/advice/daily-advice';
import { DevPanel } from '@/components/dev/dev-panel';
import { BudgetCard } from '@/components/journal/budget-card';
import { MealSection } from '@/components/journal/meal-section';
import { Button, Text } from '@/components/ui';
import type { MealType } from '@/domain/journal/types';
import { useAdvice } from '@/hooks/use-advice';
import { useDailyBudget } from '@/hooks/use-daily-budget';
import { useJournal } from '@/hooks/use-journal';
import { useCaloriePlan, useHasCompletedOnboarding, useStoredProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { ODBL_ATTRIBUTION } from '@/lib/attribution';
import { formatIsoDate } from '@/lib/format';
import { HEALTH_DISCLAIMER } from '@/lib/legal';
import { useSessionStore } from '@/stores/session';

/**
 * Aiguillage racine.
 *
 * Un profil dont l'onboarding est terminé entre directement dans l'app : au
 * redémarrage, on ne repasse jamais par le questionnaire.
 */
export default function RootScreen() {
  const completed = useHasCompletedOnboarding();

  if (!completed) {
    return <Redirect href="/(onboarding)" />;
  }

  return <TodayScreen />;
}

/**
 * Tableau du jour.
 *
 * Entièrement local : budget, journal et totaux se lisent en base, sans un seul
 * appel réseau. Cet écran s'ouvre donc à l'identique en avion — ce qui est la
 * condition pour que le reste de l'app puisse se permettre de dépendre du
 * réseau (PHASES_2_A_5 §4.7).
 */
function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const selectedDate = useSessionStore((state) => state.selectedDate);

  const journal = useJournal(selectedDate);
  const budget = useDailyBudget(selectedDate);

  const profile = useStoredProfile();
  const plan = useCaloriePlan(profile);
  const advice = useAdvice();

  function goToSearch(mealType: MealType) {
    router.push({ pathname: '/food/search', params: { mealType } });
  }

  function goToEdit(entryId: string) {
    router.push({ pathname: '/food/add', params: { entryId } });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}>
          <View style={styles.heading}>
            <Text variant="caption" tone="textMuted">
              {formatIsoDate(selectedDate)}
            </Text>
            <Text variant="title">Ton journal</Text>
          </View>

          {budget ? (
            <BudgetCard budget={budget} testID="today-budget" />
          ) : (
            <Text variant="body" tone="textMuted">
              Ton objectif se calcule à partir de ton profil.
            </Text>
          )}

          {advice && plan ? (
            <DailyAdvice selection={advice} target={plan.target} testID="today-advice" />
          ) : null}

          <View style={styles.actions}>
            <Button
              label="Chercher un aliment"
              onPress={() => router.push('/food/search')}
              testID="today-search"
            />
            <Button
              label="Mes repas"
              variant="secondary"
              onPress={() => router.push('/meals')}
              testID="today-meals"
            />
            <Button
              label="Suivi du poids"
              variant="secondary"
              onPress={() => router.push('/weight')}
              testID="today-weight"
            />
            <Button
              label="Mes conseils"
              variant="secondary"
              onPress={() => router.push('/advice')}
              testID="today-advice-link"
            />
            <Button
              label="Idées de recettes"
              variant="secondary"
              onPress={() => router.push('/recipes')}
              testID="today-recipes"
            />
          </View>

          <View style={styles.sections}>
            {journal.sections.map((section) => (
              <MealSection
                key={section.mealType}
                mealType={section.mealType}
                entries={section.entries}
                kcal={section.kcal}
                onAdd={goToSearch}
                onEditEntry={goToEdit}
                onRemoveEntry={journal.removeEntry}
                testID={`section-${section.mealType}`}
              />
            ))}
          </View>

          <Text variant="caption" tone="textMuted" style={styles.note} testID="odbl-attribution">
            {ODBL_ATTRIBUTION}
          </Text>

          <Text variant="caption" tone="textMuted" style={styles.note}>
            {HEALTH_DISCLAIMER}
          </Text>

          {/* `__DEV__` est un littéral : le minifieur supprime cette branche du
              build de production, le panneau n'y est donc même pas monté. */}
          {__DEV__ ? <DevPanel style={styles.devPanel} /> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%' },
  content: { padding: 24, gap: 16, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
  actions: { gap: 8 },
  sections: { gap: 12 },
  note: { textAlign: 'center' },
  devPanel: { marginTop: 8 },
});
